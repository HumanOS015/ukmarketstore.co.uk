export default function HalloweenSpider() {
  return (
    <div className="halloween-spider" aria-hidden="true">
      <style>{`
        .halloween-spider {
          position: fixed;
          z-index: 60;
          top: 0;
          left: 0;
          width: 82px;
          height: 88px;
          pointer-events: none;
          opacity: 0;
          filter: drop-shadow(0 2px 3px rgba(0, 0, 0, .3));
          animation: spider-glass-crawl 34s ease-in-out 2s infinite;
        }
        .halloween-spider svg { width: 100%; height: 100%; overflow: visible; }
        .halloween-spider .web-thread { stroke: rgba(190, 195, 205, .56); stroke-width: 1; }
        .halloween-spider .leg {
          fill: none;
          stroke: url(#spider-leg);
          stroke-width: 5;
          stroke-linecap: round;
          stroke-linejoin: round;
          transform-box: fill-box;
        }
        .halloween-spider .leg-detail {
          fill: none;
          stroke: rgba(255,255,255,.8);
          stroke-width: 1.1;
          stroke-linecap: round;
        }
        .halloween-spider .left-leg { transform-origin: right center; animation: spider-step-left .24s ease-in-out infinite alternate; }
        .halloween-spider .right-leg { transform-origin: left center; animation: spider-step-right .24s ease-in-out infinite alternate; }
        .halloween-spider .eye { fill: #d81e36; stroke: #7b091a; stroke-width: 1.3; }
        .halloween-spider .eye-glint { fill: #fff0f0; }
        @keyframes spider-glass-crawl {
          0%, 4% { opacity: 0; transform: translate(-90px, 13vh) rotate(-14deg); }
          7% { opacity: 1; }
          24% { transform: translate(20vw, 8vh) rotate(12deg); }
          43% { transform: translate(42vw, 29vh) rotate(-8deg); }
          63% { transform: translate(67vw, 13vh) rotate(15deg); }
          81% { transform: translate(82vw, 57vh) rotate(-12deg); }
          92% { opacity: 1; transform: translate(110vw, 34vh) rotate(22deg); }
          96%, 100% { opacity: 0; transform: translate(110vw, 34vh) rotate(22deg); }
        }
        @keyframes spider-step-left { from { transform: rotate(-12deg); } to { transform: rotate(12deg); } }
        @keyframes spider-step-right { from { transform: rotate(12deg); } to { transform: rotate(-12deg); } }
        @media (prefers-reduced-motion: reduce) {
          .halloween-spider { animation: none; opacity: .8; left: 65vw; top: 14vh; }
          .halloween-spider .leg { animation: none; }
        }
      `}</style>
      <svg viewBox="0 0 120 120" role="presentation">
        <defs>
          <radialGradient id="spider-abdomen" cx="35%" cy="28%" r="75%">
            <stop offset="0" stopColor="#fff" />
            <stop offset=".52" stopColor="#f5f4ef" />
            <stop offset="1" stopColor="#bfc1c4" />
          </radialGradient>
          <radialGradient id="spider-head" cx="34%" cy="25%" r="80%">
            <stop offset="0" stopColor="#fff" />
            <stop offset=".62" stopColor="#e9e8e3" />
            <stop offset="1" stopColor="#aeb1b5" />
          </radialGradient>
          <linearGradient id="spider-leg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fff" />
            <stop offset=".55" stopColor="#e6e5e1" />
            <stop offset="1" stopColor="#a8abb0" />
          </linearGradient>
        </defs>
        <path className="web-thread" d="M59 0 C57 17 63 24 59 37" />
        <ellipse cx="61" cy="89" rx="21" ry="4" fill="rgba(0,0,0,.16)" />
        <g className="left-leg">
          <path className="leg" d="M49 57 L34 46 L22 29 L8 23" />
          <path className="leg-detail" d="M48 56 L34 46 L22 29" />
          <path className="leg" d="M46 61 L29 58 L15 46 L4 45" />
          <path className="leg-detail" d="M45 60 L29 58 L15 46" />
          <path className="leg" d="M47 66 L29 72 L17 68 L7 75" />
          <path className="leg-detail" d="M46 65 L29 72 L17 68" />
          <path className="leg" d="M51 70 L37 85 L27 88 L20 101" />
          <path className="leg-detail" d="M50 69 L37 85 L27 88" />
        </g>
        <g className="right-leg">
          <path className="leg" d="M71 57 L86 46 L98 29 L112 23" />
          <path className="leg-detail" d="M72 56 L86 46 L98 29" />
          <path className="leg" d="M74 61 L91 58 L105 46 L116 45" />
          <path className="leg-detail" d="M75 60 L91 58 L105 46" />
          <path className="leg" d="M73 66 L91 72 L103 68 L113 75" />
          <path className="leg-detail" d="M74 65 L91 72 L103 68" />
          <path className="leg" d="M69 70 L83 85 L93 88 L100 101" />
          <path className="leg-detail" d="M70 69 L83 85 L93 88" />
        </g>
        <ellipse cx="60" cy="43" rx="17" ry="22" fill="url(#spider-abdomen)" stroke="#a9abb0" strokeWidth="1.5" />
        <path d="M52 33 Q60 28 68 34" fill="none" stroke="#fff" strokeWidth="2" opacity=".8" strokeLinecap="round" />
        <ellipse cx="60" cy="63" rx="12" ry="10" fill="url(#spider-head)" stroke="#a9abb0" strokeWidth="1.4" />
        <circle className="eye" cx="55" cy="60" r="3.5" />
        <circle className="eye" cx="65" cy="60" r="3.5" />
        <circle className="eye-glint" cx="54" cy="59" r="1" />
        <circle className="eye-glint" cx="64" cy="59" r="1" />
        <circle cx="60" cy="66" r="1.7" fill="#6b6d72" />
        <g fill="#d5d4d0" opacity=".9">
          <circle cx="49" cy="42" r="1" /><circle cx="72" cy="45" r="1" />
          <circle cx="54" cy="51" r=".8" /><circle cx="67" cy="37" r=".8" />
        </g>
      </svg>
    </div>
  );
}
