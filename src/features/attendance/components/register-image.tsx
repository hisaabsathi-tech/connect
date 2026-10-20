import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import Svg, { Path, Rect, Text as SvgText } from "react-native-svg";

import {
  REGISTER_FONTS,
  REGISTER_HEIGHTS,
  REGISTER_STYLE,
  type RegisterLayout,
} from "../lib/register";

// Exported at twice the layout size, like the web register.
const SCALE = 2;

type Font = (typeof REGISTER_FONTS)[keyof typeof REGISTER_FONTS];

/** Text centred in a cell; SVG has no vertical centring that works the same everywhere. */
function Cell({
  color = REGISTER_STYLE.ink,
  font,
  height,
  text,
  width,
  x,
  y,
}: {
  color?: string;
  font: Font;
  height: number;
  text: string;
  width: number;
  x: number;
  y: number;
}) {
  if (!text) return null;
  return (
    <SvgText
      fill={color}
      fontFamily="sans-serif"
      fontSize={font.size}
      fontWeight={font.weight}
      // See REGISTER_FONTS: no font kerning on spaced (bold) text, just even gaps.
      kerning={font.spacing ? 0 : undefined}
      letterSpacing={font.spacing || undefined}
      textAnchor="middle"
      x={x + width / 2}
      y={y + height / 2 + font.size * 0.35}
    >
      {text}
    </SvgText>
  );
}

/** The register as SVG in layout units; `viewBox` lets it draw at any bitmap size. */
function RegisterSvg({ layout, svgRef }: { layout: RegisterLayout; svgRef: React.Ref<Svg> }) {
  const { columns, height, lines, width } = layout;
  const h = REGISTER_HEIGHTS;
  const fonts = REGISTER_FONTS;
  const style = REGISTER_STYLE;
  const headerY = h.title + h.meta;
  const remarksX = columns.name + columns.checkIn + columns.checkOut;
  const remarksW = columns.remark * 2;
  const checkOutX = columns.name + columns.checkIn;

  // Grid: row lines across, the outer edges, the meta divider and the column lines.
  const grid: string[] = [];
  const rowYs = [0, h.title, headerY, headerY + h.header];
  lines.forEach((_, index) => {
    rowYs.push(headerY + h.header + (index + 1) * h.body);
  });
  for (const y of rowYs) grid.push(`M0 ${y + 0.5}H${width}`);
  grid.push(`M0.5 0V${height}`, `M${width - 0.5} 0V${height}`);
  grid.push(`M${remarksX + 0.5} ${h.title}V${headerY}`);
  for (const x of [columns.name, checkOutX, remarksX])
    grid.push(`M${x + 0.5} ${headerY}V${height}`);
  grid.push(`M${remarksX + columns.remark + 0.5} ${headerY + h.header}V${height}`);

  return (
    <Svg
      height={1}
      preserveAspectRatio="none"
      ref={svgRef}
      viewBox={`0 0 ${width} ${height}`}
      width={1}
    >
      <Rect fill={style.titleFill} height={h.title} width={width} x={0} y={0} />
      <Cell font={fonts.title} height={h.title} text={layout.title} width={width} x={0} y={0} />
      <Rect fill={style.metaFill} height={h.meta} width={width} x={0} y={h.title} />
      <Cell
        font={fonts.meta}
        height={h.meta}
        text={layout.hours}
        width={remarksX}
        x={0}
        y={h.title}
      />
      <Cell
        font={fonts.meta}
        height={h.meta}
        text={layout.date}
        width={remarksW}
        x={remarksX}
        y={h.title}
      />
      <Rect fill={style.headerFill} height={h.header} width={width} x={0} y={headerY} />
      <Cell
        font={fonts.header}
        height={h.header}
        text="NAME"
        width={columns.name}
        x={0}
        y={headerY}
      />
      <Cell
        font={fonts.header}
        height={h.header}
        text="CHECK IN TIME"
        width={columns.checkIn}
        x={columns.name}
        y={headerY}
      />
      <Cell
        font={fonts.header}
        height={h.header}
        text="CHECK OUT TIME"
        width={columns.checkOut}
        x={checkOutX}
        y={headerY}
      />
      <Cell
        font={fonts.header}
        height={h.header}
        text="REMARKS"
        width={remarksW}
        x={remarksX}
        y={headerY}
      />
      {lines.map((line, index) => {
        const y = headerY + h.header + index * h.body;
        const timeFont = line.absent ? fonts.absent : fonts.body;
        const timeColor = line.absent ? style.absentColor : style.ink;
        return (
          <Fragment key={index}>
            <Rect fill={style.bodyFill} height={h.body} width={width} x={0} y={y} />
            <Cell
              font={fonts.body}
              height={h.body}
              text={line.name}
              width={columns.name}
              x={0}
              y={y}
            />
            <Cell
              color={timeColor}
              font={timeFont}
              height={h.body}
              text={line.checkIn}
              width={columns.checkIn}
              x={columns.name}
              y={y}
            />
            <Cell
              color={timeColor}
              font={timeFont}
              height={h.body}
              text={line.checkOut}
              width={columns.checkOut}
              x={checkOutX}
              y={y}
            />
            <Cell
              font={fonts.body}
              height={h.body}
              text={line.remarks[0]}
              width={columns.remark}
              x={remarksX}
              y={y}
            />
            <Cell
              font={fonts.body}
              height={h.body}
              text={line.remarks[1]}
              width={columns.remark}
              x={remarksX + columns.remark}
              y={y}
            />
          </Fragment>
        );
      })}
      <Path d={grid.join("")} fill="none" stroke={style.line} strokeWidth={1} />
    </Svg>
  );
}

/**
 * Turns register layouts into PNGs (base64). Render `element` once on the page: it mounts each
 * register out of sight just long enough to draw it into a bitmap at twice its size.
 */
export function useRegisterRenderer() {
  const [layout, setLayout] = useState<RegisterLayout | null>(null);
  const svg = useRef<Svg>(null);
  const pending = useRef<{
    resolve: (png: string) => void;
    reject: (error: Error) => void;
  } | null>(null);

  // Once a register is mounted, draw it and hand the PNG back.
  useEffect(() => {
    if (!layout) return;
    const frame = requestAnimationFrame(() => {
      const request = pending.current;
      const view = svg.current;
      if (!(request && view)) return;
      pending.current = null;
      try {
        view.toDataURL((png) => request.resolve(png), {
          height: Math.round(layout.height * SCALE),
          width: Math.round(layout.width * SCALE),
        });
      } catch (error) {
        request.reject(error instanceof Error ? error : new Error("Couldn't draw the register."));
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [layout]);

  const render = useCallback(
    (next: RegisterLayout) =>
      new Promise<string>((resolve, reject) => {
        pending.current = { reject, resolve };
        setLayout(next);
      }).finally(() => setLayout(null)),
    [],
  );

  const element = layout ? (
    <View
      pointerEvents="none"
      style={{
        height: 1,
        left: 0,
        opacity: 0,
        overflow: "hidden",
        position: "absolute",
        top: 0,
        width: 1,
      }}
    >
      <RegisterSvg layout={layout} svgRef={svg} />
    </View>
  ) : null;

  return { element, render };
}
