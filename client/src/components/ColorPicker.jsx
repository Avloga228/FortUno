import React from "react";
import "./ColorPicker.css";

const COLORS = [
  { name: "red", code: "#ff6f61" },
  { name: "yellow", code: "#ffe066" },
  { name: "green", code: "#43cea2" },
  { name: "blue", code: "#185a9d" },
  { name: "purple", code: "#a259c4" }
];

function getSectorPath(cx, cy, r, startAngle, endAngle) {
  // Перетворення градусів у радіани
  const start = (Math.PI / 180) * startAngle;
  const end = (Math.PI / 180) * endAngle;
  // Початкова точка
  const x1 = cx + r * Math.cos(start);
  const y1 = cy + r * Math.sin(start);
  // Кінцева точка
  const x2 = cx + r * Math.cos(end);
  const y2 = cy + r * Math.sin(end);
  // Велика дуга ( > 180° ?)
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return [
    `M ${cx} ${cy}`,
    `L ${x1} ${y1}`,
    `A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`,
    "Z"
  ].join(" ");
}

export default function ColorPicker({ onPick }) {
  const cx = 100, cy = 100, r = 90;
  const sectorAngle = 360 / COLORS.length;

  return (
    <svg width={220} height={220} viewBox="0 0 200 200" className="color-picker-svg">
      {COLORS.map((color, i) => {
        const startAngle = i * sectorAngle - 90;
        const endAngle = (i + 1) * sectorAngle - 90;
        return (
          <path
            key={color.name}
            d={getSectorPath(cx, cy, r, startAngle, endAngle)}
            fill={color.code}
            className="color-sector"
            onClick={() => onPick(color.name)}
          />
        );
      })}
      <circle cx={cx} cy={cy} r={45} fill="#fff" stroke="#ccc" strokeWidth="3" />
    </svg>
  );
}