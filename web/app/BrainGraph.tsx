"use client";
import { useEffect, useMemo, useState } from "react";
import { Language, translator } from "./i18n";
type Node = { path: string; title: string; links: number };
type Graph = {
  name: string;
  nodes: Node[];
  edges: { source: string; target: string }[];
  total: number;
  truncated: boolean;
  unresolved: number;
  skipped: number;
};
export default function BrainGraph({
  language,
  request,
  onOpen,
  revision = 0,
}: {
  language: Language;
  request: (path: string) => Promise<any>;
  onOpen: (path: string) => void;
  revision?: number;
}) {
  const t = translator(language);
  const [graph, setGraph] = useState<Graph | null>(null),
    [error, setError] = useState(""),
    [selected, setSelected] = useState(""),
    [search, setSearch] = useState(""),
    [zoom, setZoom] = useState(1),
    [labels, setLabels] = useState(false);
  useEffect(() => {
    let active = true;
    void request("/obsidian/graph")
      .then((g) => {
        if (active) {
          if (Array.isArray(g.nodes) && Array.isArray(g.edges)) {
            setGraph(g);
            setError("");
          } else setError("Graph data is unavailable.");
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [revision]);
  const positions = useMemo(() => {
    const nodes = graph?.nodes || [];
    const points = nodes.map((n, i) => ({
      ...n,
      x:
        500 +
        Math.cos(i * 2.39996) *
          Math.sqrt((i + 0.5) / Math.max(1, nodes.length)) *
          410,
      y:
        320 +
        Math.sin(i * 2.39996) *
          Math.sqrt((i + 0.5) / Math.max(1, nodes.length)) *
          245,
    }));
    const map = new Map(points.map((p) => [p.path, p]));
    for (let iteration = 0; iteration < 100; iteration++) {
      for (let i = 0; i < points.length; i++)
        for (let j = i + 1; j < points.length; j++) {
          const a = points[i],
            b = points[j],
            dx = a.x - b.x,
            dy = a.y - b.y,
            d2 = Math.max(30, dx * dx + dy * dy),
            force = Math.min(8, 6000 / d2),
            len = Math.sqrt(d2);
          a.x += (dx / len) * force;
          a.y += (dy / len) * force;
          b.x -= (dx / len) * force;
          b.y -= (dy / len) * force;
        }
      for (const e of graph?.edges || []) {
        const a = map.get(e.source),
          b = map.get(e.target);
        if (a && b) {
          const dx = (b.x - a.x) * 0.004,
            dy = (b.y - a.y) * 0.004;
          a.x += dx;
          a.y += dy;
          b.x -= dx;
          b.y -= dy;
        }
      }
      for (const p of points) {
        p.x = Math.max(50, Math.min(950, p.x + (500 - p.x) * 0.003));
        p.y = Math.max(40, Math.min(610, p.y + (320 - p.y) * 0.003));
      }
    }
    if (points.length === 1) {
      points[0].x = 500;
      points[0].y = 325;
    }
    if (points.length > 1) {
      const minX = Math.min(...points.map((p) => p.x)),
        maxX = Math.max(...points.map((p) => p.x));
      const minY = Math.min(...points.map((p) => p.y)),
        maxY = Math.max(...points.map((p) => p.y));
      const scale = Math.min(
        760 / Math.max(160, maxX - minX),
        480 / Math.max(120, maxY - minY),
      );
      for (const point of points) {
        point.x = 500 + (point.x - (minX + maxX) / 2) * scale;
        point.y = 325 + (point.y - (minY + maxY) / 2) * scale;
      }
    }
    return map;
  }, [graph]);
  const matches = (node: Node) =>
    !search || node.path.toLowerCase().includes(search.toLowerCase());
  const neighbors = new Set(
    (graph?.edges || [])
      .filter((e) => e.source === selected || e.target === selected)
      .flatMap((e) => [e.source, e.target]),
  );
  const current = graph?.nodes.find((n) => n.path === selected);
  return (
    <section className="brain-graph card" aria-label={t("Wissensgraph")}>
      <div className="graph-heading">
        <div>
          <span className="eyebrow">AI BRAIN / OBSIDIAN</span>
          <h3>{graph?.name || "mono_frame_brain"}</h3>
        </div>
        <span>
          {graph?.nodes.length || 0} / {graph?.total || 0} {t("Notizen")} ·{" "}
          {graph?.edges.length || 0} {t("Verbindungen")}
        </span>
      </div>
      {error && <p role="alert">{t(error)}</p>}
      <div className="graph-controls">
        <input
          aria-label={t("Graph durchsuchen")}
          placeholder={t("Graph durchsuchen")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          aria-label={t("Verkleinern")}
          onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
        >
          −
        </button>
        <button
          onClick={() => {
            setZoom(1);
            setSelected("");
            setSearch("");
          }}
        >
          {t("Zurücksetzen")}
        </button>
        <button
          aria-label={t("Vergrößern")}
          onClick={() => setZoom(Math.min(3, zoom + 0.25))}
        >
          +
        </button>
        <button aria-pressed={labels} onClick={() => setLabels(!labels)}>
          {t("Beschriftungen")}
        </button>
      </div>
      <div className="graph-canvas">
        <svg
          viewBox={`${500 - 500 / zoom} ${325 - 325 / zoom} ${1000 / zoom} ${650 / zoom}`}
          role="group"
          aria-label={t("Verlinkte Notizen")}
        >
          {(graph?.edges || []).map((e) => {
            const a = positions.get(e.source),
              b = positions.get(e.target);
            return a && b ? (
              <line
                key={e.source + "|" + e.target}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                className={
                  neighbors.has(e.source) && neighbors.has(e.target)
                    ? "graph-edge highlighted"
                    : "graph-edge"
                }
              />
            ) : null;
          })}
          {Array.from(positions.values())
            .filter(
              (node) =>
                labels || selected === node.path || (!!search && matches(node)),
            )
            .map((node) => (
              <text
                key={"label-" + node.path}
                x={Math.min(800, node.x + 12)}
                y={node.y + 4}
                opacity={matches(node) ? 1 : 0.1}
                aria-hidden="true"
              >
                {node.title.slice(0, 35)}
              </text>
            ))}
          {Array.from(positions.values()).map((node) => {
            return (
              <g
                role="button"
                tabIndex={matches(node) ? 0 : -1}
                aria-label={
                  node.title + ": " + node.links + " " + t("Verbindungen")
                }
                key={node.path}
                opacity={matches(node) ? 1 : 0.1}
                onClick={() => setSelected(node.path)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelected(node.path);
                  }
                }}
              >
                <rect
                  x={node.x - 18}
                  y={node.y - 18}
                  width={36}
                  height={36}
                  fill="transparent"
                />
                <rect
                  x={node.x - 6}
                  y={node.y - 6}
                  width={12}
                  height={12}
                  className={
                    selected === node.path
                      ? "graph-node selected"
                      : neighbors.has(node.path)
                        ? "graph-node neighbor"
                        : "graph-node"
                  }
                />
                <title>{node.path}</title>
              </g>
            );
          })}
        </svg>
        {graph && !graph.nodes.length && (
          <p className="graph-empty">{t("Noch keine Notizen im Graph.")}</p>
        )}
      </div>
      <div className="graph-selection">
        {current ? (
          <>
            <strong>{current.path}</strong>
            <span>
              {current.links} {t("Verbindungen")}
            </span>
            <button
              aria-label={t("Notiz öffnen")}
              onClick={() => onOpen(current.path)}
            >
              {t("Notiz öffnen")} ↗
            </button>
          </>
        ) : (
          <p>
            {t(
              "Wähle einen Knoten, um seine Verbindungen und Notiz zu öffnen.",
            )}
          </p>
        )}
      </div>
      {graph && (graph.truncated || graph.skipped > 0) && (
        <p className="graph-limits">
          {t(
            "Begrenzte Graphansicht. Große oder nicht lesbare Notizen wurden teilweise ausgelassen.",
          )}
        </p>
      )}
      {!!graph?.unresolved && (
        <p className="graph-limits">
          {graph.unresolved} {t("nicht aufgelöste Links")}
        </p>
      )}
    </section>
  );
}
