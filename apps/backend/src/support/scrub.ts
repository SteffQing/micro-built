import type { TextStreamPart, ToolSet } from 'ai';
import { maskSensitive } from './redact';

// The backstop on the reply stream (C3): an `experimental_transform` that masks emails, phone numbers and runs of 10 or
// 11 digits. Text is held back until it can't still be the start of one (a partial word, or a trailing number that
// may continue), so a phone number split across chunks is still caught. The real protection is that tools never
// return raw personal data; this only catches what a model makes up or repeats.

const MAX_HELD = 200;
// The tail that might still grow into something to mask: a run of digits and phone punctuation, then a partial word.
const OPEN_TAIL = /(?:[+\d][\d \t().-]*)?\S*$/;

export function splitSafe(buffer: string): [ready: string, held: string] {
  if (buffer.length > MAX_HELD) return [buffer, ''];
  const tail = OPEN_TAIL.exec(buffer);
  const cut = tail ? tail.index : buffer.length;
  return [buffer.slice(0, cut), buffer.slice(cut)];
}

export function scrub<TOOLS extends ToolSet>() {
  return () => {
    const held = new Map<string, string>();
    const flush = (controller: TransformStreamDefaultController<TextStreamPart<TOOLS>>, id: string) => {
      const text = held.get(id);
      held.delete(id);
      if (text) controller.enqueue({ type: 'text-delta', id, text: maskSensitive(text) } as TextStreamPart<TOOLS>);
    };
    return new TransformStream<TextStreamPart<TOOLS>, TextStreamPart<TOOLS>>({
      transform(part, controller) {
        if (part.type === 'text-delta') {
          const [ready, rest] = splitSafe((held.get(part.id) ?? '') + part.text);
          held.set(part.id, rest);
          if (ready) controller.enqueue({ ...part, text: maskSensitive(ready) });
          return;
        }
        // Anything else (the end of a text part, a tool call, the finish) comes after the text before it.
        for (const id of [...held.keys()]) flush(controller, id);
        controller.enqueue(part);
      },
      flush(controller) {
        for (const id of [...held.keys()]) flush(controller, id);
      },
    });
  };
}
