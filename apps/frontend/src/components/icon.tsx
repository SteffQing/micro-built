import React from "react";
import { type IconData, icons } from "./icon-data";

export type { IconData } from "./icon-data";
export { icons } from "./icon-data";

type IconElement = [string, { [key: string]: string | number }] | readonly [string, { readonly [key: string]: string | number }];

export interface IconProps extends React.HTMLAttributes<SVGSVGElement> {
  icon: IconData;
  size?: number;
  strokeWidth?: number;
  absoluteStrokeWidth?: boolean;
  color?: string;
}

export function Icon({
  icon,
  size = 16,
  strokeWidth,
  absoluteStrokeWidth = false,
  color = "currentColor",
  className,
  ...rest
}: IconProps) {
  const calculatedStrokeWidth = strokeWidth !== undefined
    ? absoluteStrokeWidth
      ? (Number(strokeWidth) * 24) / Number(size)
      : strokeWidth
    : undefined;

  const strokeProps = calculatedStrokeWidth !== undefined
    ? { strokeWidth: calculatedStrokeWidth, stroke: "currentColor" }
    : {};

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      color={color}
      className={className}
      {...strokeProps}
      {...rest}
    >
      {[...icon]
        .sort((a: IconElement, b: IconElement) => {
          const hasA = a[1].opacity !== undefined;
          const hasB = b[1].opacity !== undefined;
          return hasB ? 1 : hasA ? -1 : 0;
        })
        .map((element: IconElement) => {
          const [tag, attrs] = element;
          const { key, ...restAttrs } = attrs as typeof attrs & { key?: string };
          return React.createElement(
            tag,
            { ...restAttrs, ...strokeProps, key: key as string },
          );
        })}
    </svg>
  );
}
