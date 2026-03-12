import { useEffect, useRef, useCallback } from "react";
import avatarSrc from "../../../assets/assistant-avatar.png";

/**
 * Photorealistic assistant face with Canvas-based mouth animation.
 * Uses the avatar image as base, draws animated lips over the mouth region
 * when speaking, and adds blinking + idle micro-animations.
 *
 * Props:
 *   - speaking: boolean
 *   - listening: boolean
 *   - size: number (default 120)
 */
export default function AssistantFace({ speaking = false, listening = false, size = 120 }) {
    const canvasRef = useRef(null);
    const imageRef = useRef(null);
    const frameRef = useRef(null);
    const stateRef = useRef({
        speaking: false,
        listening: false,
        blinkTimer: 0,
        isBlinking: false,
        blinkPhase: 0,
        mouthOpenness: 0,
        targetMouthOpen: 0,
        nextMouthChange: 0,
        breathPhase: 0
    });

    // Keep refs synced
    useEffect(() => {
        stateRef.current.speaking = speaking;
        stateRef.current.listening = listening;
    }, [speaking, listening]);

    const draw = useCallback(function drawFrame(timestamp) {
        const canvas = canvasRef.current;
        const img = imageRef.current;
        if (!canvas || !img || !img.complete) {
            frameRef.current = requestAnimationFrame(drawFrame);
            return;
        }

        const ctx = canvas.getContext("2d");
        const w = canvas.width;
        const h = canvas.height;
        const s = stateRef.current;
        const dt = 16; // ~60fps

        // ── Clear & draw avatar image ──
        ctx.clearRect(0, 0, w, h);

        // Create circular clip
        ctx.save();
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, w / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();

        // Subtle breathing animation
        s.breathPhase += 0.002;
        const breathScale = 1 + Math.sin(s.breathPhase) * 0.003;
        const bOffset = (1 - breathScale) * w / 2;

        ctx.drawImage(img, bOffset, bOffset, w * breathScale, h * breathScale);

        // ── Blink animation ──
        s.blinkTimer -= dt;
        if (s.blinkTimer <= 0 && !s.isBlinking) {
            s.isBlinking = true;
            s.blinkPhase = 0;
            s.blinkTimer = 2500 + Math.random() * 3000;
        }

        if (s.isBlinking) {
            s.blinkPhase += 0.15;
            const blinkAmount = Math.sin(s.blinkPhase * Math.PI);

            if (s.blinkPhase >= 1) {
                s.isBlinking = false;
            } else {
                // Draw eyelid overlays
                const eyeY = h * 0.38;
                const eyeW = w * 0.08;
                const eyeH = w * 0.035 * blinkAmount;

                // Left eye
                ctx.fillStyle = skinAt(ctx, w * 0.38, eyeY, w, h);
                ctx.beginPath();
                ctx.ellipse(w * 0.38, eyeY, eyeW, eyeH, 0, 0, Math.PI * 2);
                ctx.fill();

                // Right eye
                ctx.fillStyle = skinAt(ctx, w * 0.62, eyeY, w, h);
                ctx.beginPath();
                ctx.ellipse(w * 0.62, eyeY, eyeW, eyeH, 0, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // ── Mouth animation ──
        const mouthCenterX = w * 0.5;
        const mouthCenterY = h * 0.68;
        const mouthWidth = w * 0.12;
        const mouthMaxHeight = w * 0.07;

        if (s.speaking) {
            // Dynamic mouth opening
            if (timestamp > s.nextMouthChange) {
                s.targetMouthOpen = 0.2 + Math.random() * 0.8;
                s.nextMouthChange = timestamp + 80 + Math.random() * 120;
            }

            // Smooth interpolation
            s.mouthOpenness += (s.targetMouthOpen - s.mouthOpenness) * 0.3;
        } else {
            // Close mouth smoothly
            s.mouthOpenness += (0 - s.mouthOpenness) * 0.15;
        }

        if (s.mouthOpenness > 0.02) {
            const openH = mouthMaxHeight * s.mouthOpenness;
            const openW = mouthWidth * (0.7 + s.mouthOpenness * 0.3);

            // Sample skin color for the region
            const skinColor = skinAt(ctx, mouthCenterX, mouthCenterY, w, h);

            // Cover original mouth with skin patch
            ctx.fillStyle = skinColor;
            ctx.beginPath();
            ctx.ellipse(mouthCenterX, mouthCenterY, openW * 1.3, openH * 1.6 + 4, 0, 0, Math.PI * 2);
            ctx.fill();

            // Draw mouth opening (dark interior)
            ctx.fillStyle = "#2d1518";
            ctx.beginPath();
            ctx.ellipse(mouthCenterX, mouthCenterY, openW, openH, 0, 0, Math.PI * 2);
            ctx.fill();

            // Tongue hint
            if (s.mouthOpenness > 0.4) {
                ctx.fillStyle = "#c4626a";
                ctx.beginPath();
                ctx.ellipse(mouthCenterX, mouthCenterY + openH * 0.35, openW * 0.5, openH * 0.35, 0, 0, Math.PI);
                ctx.fill();
            }

            // Upper lip
            ctx.strokeStyle = "#a06054";
            ctx.lineWidth = Math.max(1.5, w * 0.008);
            ctx.beginPath();
            ctx.moveTo(mouthCenterX - openW * 1.05, mouthCenterY - openH * 0.3);
            ctx.quadraticCurveTo(mouthCenterX - openW * 0.3, mouthCenterY - openH * 1.2, mouthCenterX, mouthCenterY - openH * 0.7);
            ctx.quadraticCurveTo(mouthCenterX + openW * 0.3, mouthCenterY - openH * 1.2, mouthCenterX + openW * 1.05, mouthCenterY - openH * 0.3);
            ctx.stroke();

            // Lower lip
            ctx.beginPath();
            ctx.moveTo(mouthCenterX - openW * 1.05, mouthCenterY + openH * 0.3);
            ctx.quadraticCurveTo(mouthCenterX, mouthCenterY + openH * 1.3, mouthCenterX + openW * 1.05, mouthCenterY + openH * 0.3);
            ctx.stroke();

            // Teeth
            if (s.mouthOpenness > 0.3) {
                ctx.fillStyle = "rgba(255,255,255,0.9)";
                ctx.beginPath();
                ctx.rect(mouthCenterX - openW * 0.6, mouthCenterY - openH * 0.6, openW * 1.2, openH * 0.4);
                ctx.fill();
            }
        }

        // ── Listening glow ring ──
        if (s.listening) {
            ctx.restore();
            ctx.save();
            const glowPhase = (timestamp * 0.003) % (Math.PI * 2);
            const glowAlpha = 0.3 + Math.sin(glowPhase) * 0.2;
            ctx.strokeStyle = `rgba(99, 102, 241, ${glowAlpha})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(w / 2, h / 2, w / 2 + 2, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.restore();
        frameRef.current = requestAnimationFrame(drawFrame);
    }, []);

    // Load image & start animation loop
    useEffect(() => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = avatarSrc;
        img.onload = () => {
            imageRef.current = img;
        };
        imageRef.current = img;

        frameRef.current = requestAnimationFrame(draw);

        return () => {
            if (frameRef.current) cancelAnimationFrame(frameRef.current);
        };
    }, [draw]);

    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const canvasSize = size * dpr;

    return (
        <div
            style={{
                width: size,
                height: size,
                borderRadius: "50%",
                overflow: "hidden",
                position: "relative",
                flexShrink: 0
            }}
        >
            <canvas
                ref={canvasRef}
                width={canvasSize}
                height={canvasSize}
                style={{
                    width: size,
                    height: size,
                    display: "block"
                }}
            />
        </div>
    );
}

/**
 * Sample approximate skin color around a pixel on canvas.
 * Falls back to a warm skin tone if canvas isn't available.
 */
function skinAt(ctx, x, y, w, h) {
    try {
        const px = Math.min(Math.max(Math.round(x), 1), w - 2);
        const py = Math.min(Math.max(Math.round(y - 8), 1), h - 2);
        const data = ctx.getImageData(px, py, 1, 1).data;
        if (data[3] > 100) {
            return `rgb(${data[0]}, ${data[1]}, ${data[2]})`;
        }
    } catch {
        return "#d4a07a";
    }
    return "#d4a07a";
}
