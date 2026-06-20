interface FaceBoxProps {
  boxes?: Array<{ x1: number; y1: number; x2: number; y2: number; conf?: number }>;
}

export default function FaceBox({ boxes = [] }: FaceBoxProps) {
  return (
    <div className="pointer-events-none absolute inset-0">
      {boxes.map((box, index) => {
        const width = Math.max(1, box.x2 - box.x1);
        const height = Math.max(1, box.y2 - box.y1);
        return (
          <div
            key={`${box.x1}-${index}`}
            className="absolute rounded border-2 border-mint"
            style={{
              left: `${(box.x1 / 960) * 100}%`,
              top: `${(box.y1 / 540) * 100}%`,
              width: `${(width / 960) * 100}%`,
              height: `${(height / 540) * 100}%`,
            }}
          >
            <span className="absolute -top-6 left-0 rounded bg-mint px-2 py-0.5 text-xs font-semibold text-ink">
              {box.conf ? Math.round(box.conf * 100) : 100}%
            </span>
          </div>
        );
      })}
    </div>
  );
}
