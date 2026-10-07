import { Icon, icons } from "@/components/icon";

const questions = [
  {
    q: "Who can apply?",
    a: "Salary earners whose pay MicroBuilt can deduct from through their employer's payroll. When you sign up you add your employer and payroll details, and we confirm them before your first loan.",
  },
  {
    q: "How do I repay?",
    a: "You don't have to do anything. A fixed amount comes off your salary each month until the loan is cleared. We keep that deduction to a sensible share of your net pay.",
  },
  {
    q: "What does a loan cost?",
    a: "A monthly interest rate on the amount you borrow, spread evenly over your deductions, plus a one-time management fee taken from the money we pay out. Every rate is shown before you confirm a request, and the estimator above uses today's rates.",
  },
  {
    q: "What if a month's deduction falls short?",
    a: "A default charge is added on the amount that wasn't covered, at the rate shown when you applied. You'll see it on your dashboard, and you can also make a payment yourself from the app.",
  },
  {
    q: "Can I borrow more or pay off early?",
    a: "Yes. While a loan is running you can request a top-up from your dashboard, and you can ask to clear your balance early at any time.",
  },
  {
    q: "How long does approval take?",
    a: "Our team reviews every request, and you're notified in the app as soon as yours is approved and when the money is sent to your bank.",
  },
];

export function FaqSection() {
  return (
    <section id="faq" className="scroll-mt-20 py-20 sm:py-28">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_1.6fr] lg:px-8">
        <div>
          <p className="text-sm font-semibold text-primary">FAQ</p>
          <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">Questions, answered</h2>
          <p className="mt-4 text-lg leading-8 text-muted-foreground">
            The short version of how MicroBuilt loans work.
          </p>
        </div>
        <div className="divide-y border-y">
          {questions.map(({ q, a }) => (
            <details key={q} className="group py-5 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-md text-left text-lg font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {q}
                <Icon
                  icon={icons.plus}
                  size={20}
                  className="shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-45"
                />
              </summary>
              <p className="mt-3 max-w-2xl leading-7 text-muted-foreground">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
