// How the panel and the highlight frame look (big, friendly, right-to-left).
(() => {
  const KH = (window.KidHelper = window.KidHelper || {});

  KH.css = `
    :host { all: initial; }
    * { box-sizing: border-box; font-family: "Segoe UI", Arial, "Noto Sans Hebrew", sans-serif; }
    [hidden] { display: none !important; }
    .launcher { position: fixed; bottom: 18px; left: 18px; width: 60px; height: 60px; border-radius: 50%; border: 3px solid #fff;
      background: #6c4ff5; font-size: 32px; cursor: pointer; box-shadow: 0 4px 14px rgba(0,0,0,.35); z-index: 2147483646; }
    .launcher:hover { background: #5a3de0; }
    .panel { position: fixed; bottom: 18px; width: 360px; max-width: calc(100vw - 36px); max-height: calc(100vh - 36px); overflow: auto;
      background: #fffdf5; color: #222; border: 4px solid #6c4ff5; border-radius: 22px; padding: 14px 16px 16px; font-size: 19px; line-height: 1.45;
      box-shadow: 0 8px 28px rgba(0,0,0,.4); z-index: 2147483646; }
    .panel.left { left: 18px; } .panel.right { right: 18px; }
    .head { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
    .title { flex: 1; font-weight: 700; font-size: 18px; color: #4b34c9; }
    .icon { border: 0; background: #eee; border-radius: 10px; width: 38px; height: 38px; font-size: 18px; cursor: pointer; }
    .dots { display: flex; gap: 5px; margin: 6px 0 2px; }
    .dots i { width: 12px; height: 12px; border-radius: 50%; background: #ddd; display: block; }
    .dots i.past { background: #9d8cf7; } .dots i.on { background: #6c4ff5; outline: 3px solid #cfc7fb; }
    .count { margin: 4px 0 0; font-size: 14px; color: #666; }
    .stepTitle { margin: 4px 0 6px; font-size: 26px; line-height: 1.25; color: #222; }
    .text { margin: 0 0 8px; font-size: 21px; }
    .more { margin: 0 0 8px; padding: 10px 12px; background: #fff3c4; border-radius: 12px; font-size: 18px; }
    .note { margin: 6px 0; padding: 8px 10px; background: #ffe3e3; border-radius: 12px; font-size: 16px; }
    .tools { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0; }
    .tool { border: 2px solid #6c4ff5; background: #fff; color: #4b34c9; border-radius: 12px; padding: 8px 12px; font-size: 16px; cursor: pointer; }
    .tool.active { background: #e9e4ff; }
    .nav { display: flex; gap: 10px; margin-top: 6px; }
    .nav button { flex: 1; min-height: 52px; border-radius: 14px; font-size: 20px; font-weight: 700; cursor: pointer; }
    .nextprev { border: 2px solid #6c4ff5; background: #fff; color: #4b34c9; }
    .primary { border: 0; background: #6c4ff5; color: #fff; }
    .primary:hover { background: #5a3de0; }
    .card { display: flex; align-items: center; gap: 12px; width: 100%; margin: 8px 0; padding: 12px; text-align: right;
      border: 2px solid #cfc7fb; background: #fff; border-radius: 16px; cursor: pointer; font-size: 20px; }
    .card:hover { background: #f3f0ff; border-color: #6c4ff5; }
    .big { font-size: 38px; } .cardtext { flex: 1; display: flex; flex-direction: column; } .cardtext small { color: #666; font-size: 14px; }
    .star { font-size: 28px; }
    .spot { position: fixed; z-index: 2147483645; pointer-events: none; border: 5px solid #ffcc00; border-radius: 14px;
      box-shadow: 0 0 0 9999px rgba(0,0,0,.35), 0 0 18px 6px rgba(255,204,0,.8); animation: pulse 1.2s ease-in-out infinite; }
    @keyframes pulse { 50% { border-color: #ff8a00; box-shadow: 0 0 0 9999px rgba(0,0,0,.35), 0 0 26px 10px rgba(255,138,0,.9); } }
  `;
})();
