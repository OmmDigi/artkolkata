"use client";

const Marquee = () => {
  const text = "Festive sale 50% off";

  return (
    <nav className="w-full bg-black overflow-hidden">
      <style>{`
        @keyframes marquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }

        @keyframes marquee-rtl {
          0% {
            transform: translateX(-50%);
          }
          100% {
            transform: translateX(0);
          }
        }

        .marquee-content {
          animation: marquee 4s linear infinite;
          will-change: transform;
          display: flex;
          gap: 80px;
        }

        .marquee-container:hover .marquee-content {
          animation-play-state: paused;
        }

        .marquee-item {
          flex-shrink: 0;
          white-space: nowrap;
          font-size: 15px;
          font-weight: 500;
          letter-spacing: -0.035em;
          line-height: 2.55em;
          color: white;
          font-family: 'Inter', sans-serif;
        }
      `}</style>

      <div className="marquee-container relative w-full overflow-hidden">
        <div className="marquee-content">
          {/* Original set */}
          {[...Array(5)].map((_, i) => (
            <div key={i} className="marquee-item">
              {text}
            </div>
          ))}
          {/* Duplicate set for seamless loop */}
          {[...Array(5)].map((_, i) => (
            <div key={`duplicate-${i}`} className="marquee-item">
              {text}
            </div>
          ))}
        </div>
      </div>
    </nav>
  );
};

export default Marquee;
