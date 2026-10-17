import { Component, useEffect, useState } from "react";
import "./App.css";
const API = import.meta.env.VITE_API || "http://127.0.0.1:8000";
import RoomCanvas from "./RoomCanvas";
import LOCAL_ROOMS from "./rooms.json";

function PlanScreen({ rooms, onPick }) {
  const [hover, setHover] = useState(null);
  return (<section className="page-section plan-page">
    <div className="section-heading">
      <div><span className="eyebrow">ROOM PLANNER</span><h1>어떤 공간을 꾸며볼까요?</h1>
        <p>방을 선택하면 가구와 원하는 조건에 맞춰 배치안을 만들어드려요.</p></div>
      <span className="step-pill">01 <span>/ 03</span> 공간 선택</span>
    </div>
    <div className="room-options">
      {rooms.length === 0 && <span className="empty-notice">방 데이터가 없습니다.</span>}
      {rooms.map(r => <button key={r.id} className="room-option" onClick={() => onPick(r)}
        onMouseEnter={() => setHover(r.id)} onMouseLeave={() => setHover(null)}>
        <span className="room-option-icon">⌂</span><span><strong>{r.name}</strong>
          <small>{r.width} × {r.depth} mm</small></span><span className="room-option-arrow">→</span>
      </button>)}
    </div>
    <div className="plan-card">
      <div className="card-heading"><div><strong>공간 도면</strong><span>도면 위 방 영역을 눌러도 선택할 수 있어요.</span></div></div>
      <div className="map-frame">
        <img src="/plan.jpeg" alt="방 배치 도면" />
        <svg viewBox="0 0 850 1024" aria-label="도면에서 방 선택">
        {rooms.map(r => (
          <g key={r.id} style={{ cursor: "pointer" }} onClick={() => onPick(r)}
            onMouseEnter={() => setHover(r.id)} onMouseLeave={() => setHover(null)}>
            <polygon className={hover === r.id ? "map-room is-hovered" : "map-room"}
              points={r.polygon_on_plan.map(p => p.join(",")).join(" ")} />
          </g>
        ))}
      </svg>
    </div>
    </div>
  </section>);
}

function EditScreen({ room, state, setState, onBack, onResult }) {
  const { furniture, layout, requirements } = state;
  const [name, setName] = useState(""), [w, setW] = useState(""), [d, setD] = useState("");
  const [requirementDraft, setRequirementDraft] = useState("");
  const [loading, setLoading] = useState(false), [err, setErr] = useState("");
  const requirementItems = Array.isArray(requirements) ? requirements
    : typeof requirements === "string" ? requirements.split("\n").filter(Boolean) : [];
  const add = () => {
    const W = parseInt(w, 10), D = parseInt(d, 10);
    if (!name.trim()) return setErr("가구 이름을 입력하세요");
    if (!(W > 0 && D > 0)) return setErr("가로·세로를 mm 단위 양수로 입력하세요");
    if (Math.min(W, D) > Math.min(room.width, room.depth) || Math.max(W, D) > Math.max(room.width, room.depth))
      return setErr("방보다 큰 가구예요");
    const id = "f" + Date.now().toString(36);
    const f = { id, type: name.trim(), label: name.trim(), w: W, d: D, fixed: false };
    setState(s => ({ ...s, furniture: [...s.furniture, f], layout: { ...s.layout, [id]: { x: 0, y: 0, rotation: 0 } } }));
    setName(""); setW(""); setD(""); setErr("");
  };
  const addRequirement = () => {
    const text = requirementDraft.trim();
    if (!text) return;
    setState(s => ({ ...s, requirements: [
      ...(Array.isArray(s.requirements) ? s.requirements
        : typeof s.requirements === "string" ? s.requirements.split("\n").filter(Boolean) : []),
      text
    ] }));
    setRequirementDraft(""); setErr("");
  };
  const delRequirement = index => setState(s => {
    const items = Array.isArray(s.requirements) ? s.requirements
      : typeof s.requirements === "string" ? s.requirements.split("\n").filter(Boolean) : [];
    return { ...s, requirements: items.filter((_, i) => i !== index) };
  });
  const del = id => setState(s => { const l = { ...s.layout }; delete l[id];
    return { ...s, furniture: s.furniture.filter(f => f.id !== id), layout: l }; });
  const move = (id, x, y) => setState(s => ({ ...s, layout: { ...s.layout, [id]: { ...s.layout[id], x, y } } }));
  const rotate = id => setState(s => ({ ...s, layout: { ...s.layout, [id]: { ...s.layout[id], rotation: (s.layout[id].rotation + 90) % 360 } } }));
  const generate = async () => {
    setLoading(true); setErr("");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);
    try {
      const res = await fetch(API + "/generate", { method: "POST", headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ room_id: room.id, furniture, requirements: requirementItems,
          current_layout: state.hasLayout ? Object.entries(layout).map(([id, p]) => ({ id, ...p })) : null }) });
      if (!res.ok) { let m = res.status; try { m = (await res.json()).detail || m; } catch { m = res.status + " (백엔드 미실행 가능성)"; } throw new Error(m); }
      onResult(await res.json());
    } catch (e) {
      setErr(e.name === "AbortError" ? "요청 시간이 2분을 넘어서 중단했어요. 백엔드와 Gemini API 상태를 확인한 뒤 다시 시도하세요." : String(e.message || e));
    } finally { clearTimeout(timeout); setLoading(false); }
  };
  return (<section className="page-section editor-page">
    <div className="section-heading editor-heading">
      <div><button className="back-button" onClick={onBack}>← 도면으로</button>
        <span className="eyebrow">공간 설정</span><h1>{room.name}</h1>
        <p>{room.width} × {room.depth} mm 공간에 가구와 배치 조건을 추가하세요.</p></div>
      <span className="step-pill">02 <span>/ 03</span> 배치 설정</span>
    </div>
    <div className="editor-layout">
      <aside className="side-card furniture-panel">
        <div className="card-heading"><div><strong>가구 목록</strong><span>배치할 가구를 추가하세요.</span></div>
          <span className="item-count">{furniture.length}</span></div>
        <div className="form-stack">
          <label className="field-label">가구 이름
            <input placeholder="예: 침대" value={name} onChange={e => setName(e.target.value)} /></label>
          <div className="dimension-fields">
            <label className="field-label">가로 (mm)
              <input placeholder="2000" type="number" value={w} onChange={e => setW(e.target.value)} /></label>
            <label className="field-label">세로 (mm)
              <input placeholder="1500" type="number" value={d} onChange={e => setD(e.target.value)} /></label>
          </div>
          <button className="button button-secondary" onClick={add}><span>＋</span> 가구 추가</button>
        </div>
        {furniture.length ? <ul className="item-list">{furniture.map(f =>
          <li className="list-item" key={f.id}><span className="item-dot furniture-dot" />
            <span className="list-item-copy"><strong>{f.label}</strong><small>{f.w} × {f.d} mm</small></span>
            <button className="icon-button" onClick={() => del(f.id)} aria-label={`${f.label} 삭제`}>×</button></li>)}</ul>
          : <p className="empty-state">아직 추가된 가구가 없어요.<br />위에서 첫 가구를 추가해보세요.</p>}
        <div className="helper-note">드래그하여 이동 · 더블클릭하여 90° 회전<br /><span className="collision-dot" /> 빨간 테두리는 가구 충돌을 뜻해요.</div>
      </aside>
      <section className="workspace-card">
        <div className="card-heading workspace-heading"><div><strong>배치 미리보기</strong>
          <span>가구를 드래그해 원하는 위치로 옮겨보세요.</span></div><span className="workspace-badge">실시간 편집</span></div>
        <div className="canvas-scroll"><RoomCanvas room={room} furniture={furniture} layout={layout} onMove={move} onRotate={rotate} /></div>
        <div className="legend"><span><i className="legend-pillar" />기둥</span><span><i className="legend-counter" />붙박이</span>
          <span><i className="legend-door" />문 회전반경</span><span><i className="legend-window" />창문</span></div>
      </section>
      <aside className="side-card requirements-panel">
        <div className="card-heading"><div><strong>배치 요구사항</strong><span>원하는 조건을 하나씩 추가하세요.</span></div>
          <span className="item-count">{requirementItems.length}</span></div>
        <div className="form-stack">
          <label className="field-label">요구사항
            <input value={requirementDraft} onChange={e => setRequirementDraft(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addRequirement(); } }}
        placeholder="예: 책상은 창문 옆" /></label>
          <button className="button button-secondary" onClick={addRequirement}><span>＋</span> 요구사항 추가</button>
        </div>
        {requirementItems.length ? <ul className="item-list">{requirementItems.map((item, index) =>
          <li className="list-item requirement-item" key={`${index}-${item}`}><span className="item-dot requirement-dot" />
            <span className="list-item-copy"><strong>{item}</strong></span>
            <button className="icon-button" onClick={() => delRequirement(index)} aria-label={`${item} 삭제`}>×</button></li>)}</ul>
          : <p className="empty-state">아직 요구사항이 없어요.<br />예: 침대는 문에서 멀리</p>}
        <div className="generate-area">
          <button className="button button-primary generate-button" onClick={generate} disabled={loading}>
            {loading ? <><span className="spinner" /> 생성 중... (최대 2분)</> : "배치안 생성하기"}
          </button>
          <small>가구와 요구사항을 바탕으로<br />서로 다른 배치안 3가지를 만들어요.</small>
          {err && <p className="error-message" role="alert">{err}</p>}
        </div>
      </aside>
    </div>
  </section>);
}

function ResultScreen({ room, furniture, result, onPick, onBack }) {
  return (<section className="page-section result-page">
    <div className="section-heading">
      <div><button className="back-button" onClick={onBack}>← 편집으로</button>
        <span className="eyebrow">배치안 비교</span><h1>마음에 드는 배치안을 골라보세요</h1>
        <p>선택한 배치안은 편집 화면으로 가져와 계속 수정할 수 있어요.</p></div>
      <span className="step-pill">03 <span>/ 03</span> 결과 선택</span>
    </div>
    {!result.ok && <p className="warning-banner">일부 배치안에 충돌이 남아 있어요. 빨간 테두리를 확인해 주세요.</p>}
    <div className="result-grid">
      {result.plans.map(p => {
        const layout = Object.fromEntries(p.items.map(i => [i.id, { x: i.x, y: i.y, rotation: i.rotation }]));
        return (<article className="result-card" key={p.id}>
          <div className="result-card-heading"><span className="plan-letter">{p.id}</span><div><h2>{p.concept}</h2><small>{p.id} 배치안</small></div></div>
          <div className="result-canvas"><RoomCanvas room={room} furniture={furniture} layout={layout} maxPx={330} editable={false} /></div>
          <p className="result-reason">{p.reason}</p>
          {result.errors?.[p.id]?.length > 0 && <ul className="result-errors">
            {result.errors[p.id].map((e, i) => <li key={i}>{e}</li>)}</ul>}
          <button className="button button-primary" onClick={() => onPick(layout)}>이 배치안 선택</button>
        </article>);
      })}
    </div>
  </section>);
}

class Boundary extends Component {
  state = { err: null };
  static getDerivedStateFromError(err) { return { err }; }
  render() { return this.state.err
    ? <div className="fatal-error"><h3>오류가 발생했어요</h3><pre>{String(this.state.err.stack || this.state.err)}</pre>
        <button className="button button-secondary" onClick={() => { localStorage.removeItem("rp_state"); location.reload(); }}>저장 데이터 초기화 후 새로고침</button></div>
    : this.props.children; }
}

export default function Root() { return <Boundary><App /></Boundary>; }

function App() {
  const [rooms, setRooms] = useState([]); const [room, setRoom] = useState(null);
  const [screen, setScreen] = useState("plan"); const [result, setResult] = useState(null);
  const [byRoom, setByRoom] = useState(() => JSON.parse(localStorage.getItem("rp_state") || "{}"));
  const [apiErr, setApiErr] = useState("");
  useEffect(() => { fetch(API + "/rooms").then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(setRooms).catch(e => { setRooms(LOCAL_ROOMS); setApiErr("백엔드 연결 실패(" + e.message + ") — backend 폴더에서 uvicorn main:app --port 8000 이 실행 중인지 확인하세요. 지금은 로컬 방 데이터로 표시 중"); }); }, []);
  useEffect(() => localStorage.setItem("rp_state", JSON.stringify(byRoom)), [byRoom]);
  const state = room && (byRoom[room.id] || { furniture: [], layout: {}, requirements: [], hasLayout: false });
  const setState = fn => setByRoom(b => ({ ...b, [room.id]: fn(b[room.id] || state) }));
  return <div className="app-shell">
    <header className="topbar"><a className="brand" href="#" onClick={e => { e.preventDefault(); setScreen("plan"); }}>
      <span className="brand-mark">R</span><span>room<span className="brand-light">plan</span></span>
    </a><span className="topbar-caption">나만의 공간을 더 잘 쓰는 방법</span></header>
    <main className="page-container">
      {apiErr && screen === "plan" && <p className="warning-banner">{apiErr}</p>}
      {screen === "plan" && <PlanScreen rooms={rooms} onPick={r => { setRoom(r); setScreen("edit"); }} />}
      {screen === "edit" && <EditScreen room={room} state={state} setState={setState}
        onBack={() => setScreen("plan")} onResult={r => { setResult(r); setScreen("result"); }} />}
      {screen === "result" && <ResultScreen room={room} furniture={state.furniture} result={result} onBack={() => setScreen("edit")}
        onPick={layout => { setState(s => ({ ...s, layout, hasLayout: true })); setScreen("edit"); }} />}
    </main>
  </div>;
}
