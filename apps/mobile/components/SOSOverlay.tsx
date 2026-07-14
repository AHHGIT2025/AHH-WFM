"use client";

import React, { useState, useRef } from "react";

interface SOSOverlayProps {
  onClose: () => void;
}

export const SOSOverlay: React.FC<SOSOverlayProps> = ({ onClose }) => {
  const [holding, setHolding] = useState(false);
  const [progress, setProgress] = useState(0);
  const [triggered, setTriggered] = useState(false);
  const timerRef = useRef<any>(null);

  const startHold = () => {
    if (triggered) return;
    setHolding(true);
    setProgress(0);
    const duration = 2000; // 2 seconds hold
    const interval = 50;
    let elapsed = 0;

    timerRef.current = setInterval(() => {
      elapsed += interval;
      const percent = Math.min((elapsed / duration) * 100, 100);
      setProgress(percent);

      if (percent >= 100) {
        clearInterval(timerRef.current);
        setTriggered(true);
        setHolding(false);
      }
    }, interval);
  };

  const endHold = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setHolding(false);
    setProgress(0);
  };

  return (
    <div className="fixed inset-0 bg-[#001946]/95 backdrop-blur-md z-50 flex flex-col items-center justify-center p-6 text-white font-sans">
      <button 
        onClick={onClose} 
        className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white active:scale-90 transition-transform"
      >
        <span className="material-symbols-outlined text-[20px]">close</span>
      </button>

      <div className="text-center max-w-xs space-y-6 flex-1 flex flex-col justify-center">
        {!triggered ? (
          <>
            <div className="space-y-2">
              <span className="material-symbols-outlined text-red-500 text-[64px] animate-pulse">emergency</span>
              <h2 className="text-xl font-bold tracking-tight">SOS Emergency Trigger</h2>
              <p className="text-xs text-white/70 leading-relaxed">
                Press and hold the button below for 2 seconds to broadcast a panic alert to the WFM Control Room.
              </p>
            </div>

            {/* Hold Button */}
            <div className="relative w-40 h-40 mx-auto flex items-center justify-center">
              <svg className="absolute inset-0 w-full h-full -rotate-90">
                <circle cx="80" cy="80" r="70" stroke="rgba(255,255,255,0.1)" strokeWidth="8" fill="transparent" />
                <circle 
                  cx="80" 
                  cy="80" 
                  r="70" 
                  stroke="#BA1A1A" 
                  strokeWidth="8" 
                  fill="transparent" 
                  strokeDasharray="440"
                  strokeDashoffset={440 - (440 * progress) / 100}
                  className="transition-all duration-75"
                />
              </svg>
              <button
                onMouseDown={startHold}
                onMouseUp={endHold}
                onMouseLeave={endHold}
                onTouchStart={startHold}
                onTouchEnd={endHold}
                className={`w-28 h-28 rounded-full bg-[#BA1A1A] border-4 border-white/20 flex flex-col items-center justify-center select-none active:scale-95 transition-all shadow-lg ${holding ? "brightness-110" : ""}`}
              >
                <span className="material-symbols-outlined text-[32px] mb-0.5">ring_volume</span>
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  {holding ? "HOLDING..." : "HOLD SOS"}
                </span>
              </button>
            </div>
          </>
        ) : (
          <div className="space-y-4 py-8 animate-bounce">
            <span className="material-symbols-outlined text-red-500 text-[80px]">notifications_active</span>
            <h2 className="text-xl font-bold tracking-tight text-red-500">SOS TRIGGERED</h2>
            <p className="text-xs text-white/70">
              Emergency dispatch signal active. Local coordinates mapped. (Admin Preview Mode — no real alert sent).
            </p>
            <button 
              onClick={() => setTriggered(false)}
              className="px-6 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-xs font-bold transition-all"
            >
              Reset Trigger
            </button>
          </div>
        )}
      </div>

      <div className="w-full bg-white/10 rounded-2xl p-4 border border-white/10 text-left text-xs mb-4">
        <div className="flex gap-3">
          <span className="material-symbols-outlined text-[#00A3FF]">info</span>
          <div>
            <p className="font-bold text-[#00A3FF]">Trigger Safety Override</p>
            <p className="text-white/70 text-[11px] mt-0.5">
              Live websocket broadcast signals to the dispatcher alert banner will initiate in Phase 1B.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
