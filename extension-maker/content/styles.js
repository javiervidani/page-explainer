// How the maker panel and the frame look.
(() => {
  const LM = (window.LessonMaker = window.LessonMaker || {});

  LM.css = `
    :host { all: initial; }
    * { box-sizing: border-box; font-family: "Segoe UI", Arial, "Noto Sans Hebrew", sans-serif; }
    [hidden] { display: none !important; }
    .launcher { position: fixed; bottom: 18px; left: 92px; width: 52px; height: 52px; border-radius: 50%; border: 3px solid #fff;
      background: #e65f00; font-size: 26px; cursor: pointer; box-shadow: 0 4px 14px rgba(0,0,0,.35); z-index: 2147483646; }
    .panel { position: fixed; bottom: 18px; width: 340px; max-width: calc(100vw - 36px); max-height: calc(100vh - 36px); overflow: auto;
      background: #fffaf3; color: #222; border: 4px solid #e65f00; border-radius: 18px; padding: 12px 14px 14px; font-size: 16px;
      line-height: 1.4; box-shadow: 0 8px 28px rgba(0,0,0,.4); z-index: 2147483646; }
    .panel.left { left: 18px; } .panel.right { right: 18px; }
    .head { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }
    .title { flex: 1; font-weight: 700; color: #b34700; }
    .icon { border: 0; background: #eee; border-radius: 8px; width: 34px; height: 34px; cursor: pointer; font-size: 16px; }
    label { display: block; margin: 8px 0 3px; font-size: 14px; font-weight: 600; color: #555; }
    input, textarea { width: 100%; padding: 8px 10px; border: 1px solid #c9b9a8; border-radius: 8px; font: inherit; background: #fff; }
    textarea { resize: vertical; min-height: 56px; }
    .marked { margin: 8px 0; padding: 8px 10px; background: #fff0d9; border-radius: 10px; font-size: 14px; }
    .row { display: flex; gap: 8px; margin: 8px 0; }
    .row button { flex: 1; padding: 8px; border-radius: 10px; border: 2px solid #e65f00; background: #fff; color: #b34700; font: inherit; cursor: pointer; }
    .row button.on { background: #ffe2c2; }
    .save { width: 100%; min-height: 46px; margin-top: 6px; border: 0; border-radius: 12px; background: #e65f00; color: #fff;
      font: inherit; font-size: 18px; font-weight: 700; cursor: pointer; }
    .save:disabled { opacity: .6; cursor: default; }
    .status { margin: 8px 0 0; padding: 8px 10px; border-radius: 10px; font-size: 14px; }
    .status.ok { background: #dff5e1; } .status.bad { background: #ffe3e3; }
    .hint { margin: 6px 0 0; font-size: 13px; color: #666; }
    .spot { position: fixed; z-index: 2147483645; pointer-events: none; border: 5px solid #ffcc00; border-radius: 14px;
      box-shadow: 0 0 0 9999px rgba(0,0,0,.35), 0 0 18px 6px rgba(255,204,0,.8); }
    .spot.hover { border-style: dashed; box-shadow: 0 0 0 9999px rgba(0,0,0,.15); }
  `;
})();
