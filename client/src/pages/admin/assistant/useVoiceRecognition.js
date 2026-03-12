import { useState, useRef, useCallback, useEffect } from "react";

export function useVoiceRecognition({ onWakeWord, onResult, onError, lang = "en-US" } = {}) {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState("");
    const [isWakeWordActive, setIsWakeWordActive] = useState(false);
    const recognitionRef = useRef(null);
    const wakeRecognitionRef = useRef(null);
    const wakeDetectionEnabledRef = useRef(false);
    const restartWakeWordRef = useRef(null);

    const SpeechRecognition =
        typeof window !== "undefined"
            ? window.SpeechRecognition || window.webkitSpeechRecognition
            : null;

    const isSupported = !!SpeechRecognition;

    const createRecognition = useCallback(
        (options = {}) => {
            if (!SpeechRecognition) return null;
            const rec = new SpeechRecognition();
            rec.lang = lang;
            rec.continuous = options.continuous ?? false;
            rec.interimResults = options.interimResults ?? true;
            rec.maxAlternatives = 1;
            return rec;
        },
        [SpeechRecognition, lang]
    );

    const startListening = useCallback(() => {
        if (!SpeechRecognition) {
            onError?.("Voice input is not supported in this browser.");
            return;
        }
        if (recognitionRef.current) return;

        const rec = createRecognition({ continuous: true, interimResults: true });
        recognitionRef.current = rec;
        const idleStopMs = 2000;
        setTranscript("");

        let finalText = "";
        let latestText = "";
        let silenceTimer = null;
        const resetSilenceTimer = () => {
            if (silenceTimer) clearTimeout(silenceTimer);
            silenceTimer = setTimeout(() => {
                try {
                    rec.stop();
                } catch {
                    // Ignore invalid-state errors.
                }
            }, idleStopMs);
        };

        rec.onstart = () => {
            setIsListening(true);
            resetSilenceTimer();
        };

        rec.onresult = (e) => {
            let interimTranscript = "";
            for (let i = e.resultIndex; i < e.results.length; i++) {
                const text = e.results[i][0].transcript;
                if (e.results[i].isFinal) {
                    finalText += `${text} `;
                } else {
                    interimTranscript += text;
                }
            }
            latestText = (finalText + interimTranscript).trim();
            setTranscript(latestText);
            resetSilenceTimer();
        };

        rec.onend = () => {
            if (silenceTimer) clearTimeout(silenceTimer);
            setIsListening(false);
            if (recognitionRef.current === rec) recognitionRef.current = null;
            const resolvedText = finalText.trim() || latestText;
            if (resolvedText) {
                onResult?.(resolvedText);
            }
        };

        rec.onerror = (e) => {
            if (silenceTimer) clearTimeout(silenceTimer);
            setIsListening(false);
            if (recognitionRef.current === rec) recognitionRef.current = null;
            if (e.error === "not-allowed") onError?.("Microphone permission denied.");
            else if (e.error !== "aborted") onError?.("Could not capture voice. Try again.");
        };

        try {
            rec.start();
        } catch {
            onError?.("Could not start microphone. Try again.");
        }
    }, [SpeechRecognition, createRecognition, onResult, onError]);

    const stopListening = useCallback(() => {
        if (recognitionRef.current) {
            try {
                recognitionRef.current.stop();
            } catch {
                // Ignore browser invalid-state errors.
            }
            recognitionRef.current = null;
        }
        setIsListening(false);
    }, []);

    const scheduleWakeWordRestart = useCallback((delayMs) => {
        setTimeout(() => {
            if (!wakeDetectionEnabledRef.current) return;
            restartWakeWordRef.current?.();
        }, delayMs);
    }, []);

    const startWakeWordDetection = useCallback(() => {
        if (!SpeechRecognition) return;
        wakeDetectionEnabledRef.current = true;
        if (wakeRecognitionRef.current) return;

        const rec = createRecognition({ continuous: true, interimResults: true });
        wakeRecognitionRef.current = rec;

        rec.onstart = () => setIsWakeWordActive(true);

        rec.onresult = (e) => {
            for (let i = e.resultIndex; i < e.results.length; i++) {
                const t = e.results[i][0].transcript.toLowerCase().trim();
                if (t.includes("hello assistant") || t.includes("hey assistant") || t.includes("hi assistant")) {
                    rec.stop();
                    onWakeWord?.();
                    return;
                }
            }
        };

        rec.onend = () => {
            setIsWakeWordActive(false);
            if (wakeRecognitionRef.current === rec && wakeDetectionEnabledRef.current) {
                wakeRecognitionRef.current = null;
                scheduleWakeWordRestart(300);
            } else if (wakeRecognitionRef.current === rec) {
                wakeRecognitionRef.current = null;
            }
        };

        rec.onerror = (e) => {
            if (e.error === "not-allowed") {
                onError?.("Microphone permission denied.");
                setIsWakeWordActive(false);
                wakeRecognitionRef.current = null;
                wakeDetectionEnabledRef.current = false;
                return;
            }

            if (wakeRecognitionRef.current === rec && wakeDetectionEnabledRef.current) {
                wakeRecognitionRef.current = null;
                scheduleWakeWordRestart(1000);
            } else if (wakeRecognitionRef.current === rec) {
                wakeRecognitionRef.current = null;
            }
        };

        try {
            rec.start();
        } catch {
            onError?.("Could not start wake-word listener.");
        }
    }, [SpeechRecognition, createRecognition, onWakeWord, onError, scheduleWakeWordRestart]);

    useEffect(() => {
        restartWakeWordRef.current = startWakeWordDetection;
    }, [startWakeWordDetection]);

    const stopWakeWordDetection = useCallback(() => {
        wakeDetectionEnabledRef.current = false;
        if (wakeRecognitionRef.current) {
            const rec = wakeRecognitionRef.current;
            wakeRecognitionRef.current = null;
            try {
                rec.abort();
            } catch {
                // Ignore browser invalid-state errors.
            }
        }
        setIsWakeWordActive(false);
    }, []);

    useEffect(() => {
        return () => {
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.abort();
                } catch {
                    // Ignore browser invalid-state errors.
                }
            }
            if (wakeRecognitionRef.current) {
                const rec = wakeRecognitionRef.current;
                wakeRecognitionRef.current = null;
                try {
                    rec.abort();
                } catch {
                    // Ignore browser invalid-state errors.
                }
            }
        };
    }, []);

    return {
        isListening,
        transcript,
        isSupported,
        isWakeWordActive,
        startListening,
        stopListening,
        startWakeWordDetection,
        stopWakeWordDetection,
        setTranscript
    };
}
