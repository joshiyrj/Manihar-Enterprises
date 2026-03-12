import { useState, useCallback, useRef, useEffect } from "react";
import { api } from "../../../lib/api";

export function useAssistant({ onNavigate, onDataChanged } = {}) {
    const [messages, setMessages] = useState([]);
    const [status, setStatus] = useState("idle");
    const [pendingAction, setPendingAction] = useState(null);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [capabilities, setCapabilities] = useState({
        nativeVoiceEnabled: false,
        nativeVoiceSupported: false
    });

    const synthRef = useRef(typeof window !== "undefined" ? window.speechSynthesis : null);
    const audioRef = useRef(null);
    const audioUrlRef = useRef("");
    const messagesRef = useRef([]);
    const requestInFlightRef = useRef(false);
    const executionInFlightRef = useRef(false);
    const lastSentRef = useRef({ text: "", at: 0 });
    const lastExecutionRef = useRef({ fingerprint: "", at: 0 });
    const nativeVoiceRequestedRef = useRef(
        (typeof window !== "undefined" && window.localStorage.getItem("assistant_native_voice") === "1") ||
        String(import.meta.env.VITE_ASSISTANT_NATIVE_VOICE || "").toLowerCase() === "true"
    );

    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);

    useEffect(() => {
        const synth = synthRef.current;
        if (!synth) return undefined;
        const loadVoices = () => {
            try {
                synth.getVoices();
            } catch {
                // Ignore browser speech synthesis errors.
            }
        };
        loadVoices();
        if (typeof window !== "undefined" && "onvoiceschanged" in synth) {
            synth.addEventListener?.("voiceschanged", loadVoices);
            return () => synth.removeEventListener?.("voiceschanged", loadVoices);
        }
        return undefined;
    }, []);

    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const { data } = await api.get("/api/assistant/capabilities");
                if (!active || !data) return;
                setCapabilities({
                    nativeVoiceEnabled: !!data.nativeVoiceEnabled,
                    nativeVoiceSupported: !!data.nativeVoiceSupported
                });
            } catch {
                if (active) {
                    setCapabilities({
                        nativeVoiceEnabled: false,
                        nativeVoiceSupported: false
                    });
                }
            }
        })();
        return () => {
            active = false;
        };
    }, []);

    const addMessage = useCallback((role, text) => {
        setMessages((prev) => [...prev, { role, text, time: new Date() }]);
    }, []);

    const speakWithBrowser = useCallback((text) => {
        return new Promise((resolve) => {
            if (!synthRef.current) {
                resolve();
                return;
            }

            synthRef.current.cancel();
            synthRef.current.resume?.();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 1.0;
            utterance.pitch = 1.0;
            utterance.volume = 1.0;
            utterance.lang = "en-US";

            const voices = synthRef.current.getVoices();
            const preferred =
                voices.find((v) => v.lang.startsWith("en") && v.name.includes("Google")) ||
                voices.find((v) => v.lang.startsWith("en"));
            if (preferred) utterance.voice = preferred;

            utterance.onstart = () => setIsSpeaking(true);
            utterance.onend = () => {
                setIsSpeaking(false);
                resolve();
            };
            utterance.onerror = () => {
                setIsSpeaking(false);
                resolve();
            };

            synthRef.current.speak(utterance);
        });
    }, []);

    const releaseAudio = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = "";
            audioRef.current = null;
        }
        if (audioUrlRef.current) {
            URL.revokeObjectURL(audioUrlRef.current);
            audioUrlRef.current = "";
        }
    }, []);

    const playGeneratedAudio = useCallback(async (audioBase64, mimeType = "audio/wav") => {
        if (typeof window === "undefined") throw new Error("Audio playback is not available");

        releaseAudio();

        const binary = window.atob(audioBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) {
            bytes[i] = binary.charCodeAt(i);
        }

        const blob = new Blob([bytes], { type: mimeType });
        const audioUrl = URL.createObjectURL(blob);
        audioUrlRef.current = audioUrl;

        const audio = new Audio(audioUrl);
        audio.preload = "auto";
        audioRef.current = audio;

        await new Promise((resolve, reject) => {
            let started = false;
            audio.onplaying = () => {
                started = true;
            };
            audio.onended = () => resolve();
            audio.onerror = () => reject(new Error("AUDIO_PLAYBACK_FAILED"));
            audio.play().catch((err) => reject(err || new Error("AUDIO_PLAYBACK_BLOCKED")));
            setTimeout(() => {
                if (!started && audio.paused) {
                    reject(new Error("AUDIO_PLAYBACK_TIMEOUT"));
                }
            }, 1800);
        });
    }, [releaseAudio]);

    const speak = useCallback(
        async (text) => {
            setIsSpeaking(true);
            try {
                const nativeVoice =
                    nativeVoiceRequestedRef.current &&
                    capabilities.nativeVoiceEnabled &&
                    capabilities.nativeVoiceSupported;
                const browserVoiceAvailable = !!synthRef.current;
                if (!nativeVoice && browserVoiceAvailable) {
                    await speakWithBrowser(text);
                    return;
                }

                const { data } = await api.post("/api/assistant/audio", { text, nativeVoice });
                if (!data?.audioBase64) throw new Error("No audio data returned");

                await playGeneratedAudio(data.audioBase64, data.mimeType || "audio/wav");
            } catch {
                await speakWithBrowser(text);
            } finally {
                setIsSpeaking(false);
            }
        },
        [capabilities.nativeVoiceEnabled, capabilities.nativeVoiceSupported, playGeneratedAudio, speakWithBrowser]
    );

    const stopSpeaking = useCallback(() => {
        releaseAudio();
        if (synthRef.current) synthRef.current.cancel();
        setIsSpeaking(false);
    }, [releaseAudio]);

    const executeAction = useCallback(async (action) => {
        const fingerprint = JSON.stringify(action || {});
        const now = Date.now();
        if (executionInFlightRef.current) return;
        if (lastExecutionRef.current.fingerprint === fingerprint && now - lastExecutionRef.current.at < 4000) return;
        executionInFlightRef.current = true;
        lastExecutionRef.current = { fingerprint, at: now };

        try {
            if (action.type === "navigate") {
                const pageMap = {
                    dashboard: "/admin",
                    items: "/admin/items",
                    collections: "/admin/collections",
                    profile: "/admin/profile",
                    mills: "/admin/mills",
                    quantities: "/admin/quantities",
                    designNos: "/admin/design-nos",
                    activity: "/admin/activity",
                    export: "/admin/export"
                };
                const path = pageMap[action.params?.page] || "/admin";
                onNavigate?.(path);
                return;
            }

            if (action.type === "list_items" || action.type === "list_collections") {
                const path = action.type === "list_items" ? "/admin/items" : "/admin/collections";
                onNavigate?.(path);
                return;
            }

            const { data } = await api.post("/api/assistant/execute", { action });
            if (data.ok) {
                addMessage("assistant", data.message);
                await speak(data.message);
                onDataChanged?.();
            }
        } catch (e) {
            const errMsg = e?.response?.data?.message || "Failed to execute the action.";
            addMessage("assistant", errMsg);
            await speak(errMsg);
        } finally {
            executionInFlightRef.current = false;
        }
    }, [addMessage, onDataChanged, onNavigate, speak]);

    const sendMessage = useCallback(async (text, context) => {
        const trimmed = String(text || "").trim();
        if (!trimmed) return;

        const now = Date.now();
        if (requestInFlightRef.current) return;
        if (lastSentRef.current.text.toLowerCase() === trimmed.toLowerCase() && now - lastSentRef.current.at < 1200) {
            return;
        }

        requestInFlightRef.current = true;
        lastSentRef.current = { text: trimmed, at: now };

        const historyForRequest = [
            ...messagesRef.current.map((m) => ({ role: m.role, text: m.text })),
            { role: "user", text: trimmed }
        ].slice(-20);

        addMessage("user", trimmed);
        setStatus("thinking");

        try {
            const { data } = await api.post("/api/assistant/chat", {
                message: trimmed,
                context,
                history: historyForRequest
            });
            const responseMsg = data.message || "I could not complete that request.";
            addMessage("assistant", responseMsg);

            if (data.action && data.action.type !== "none") {
                if (data.action.requiresConfirmation) {
                    setPendingAction(data.action);
                    setStatus("speaking");
                    await speak(responseMsg);
                    setStatus("idle");
                    return;
                }

                setStatus("speaking");
                await speak(responseMsg);
                await executeAction(data.action);
                setStatus("idle");
                return;
            }

            setStatus("speaking");
            await speak(responseMsg);
            setStatus("idle");
        } catch (e) {
            const serverMsg = e?.response?.data?.message;
            const statusCode = e?.response?.status;
            const errCode = e?.code;
            let errMsg;

            if (statusCode === 429) errMsg = "Assistant is temporarily busy. Please try again shortly.";
            else if (serverMsg) errMsg = serverMsg;
            else if (errCode === "ECONNABORTED") errMsg = "Assistant request timed out. Please try a shorter command.";
            else if (!e?.response) errMsg = "Connection issue. Please retry in a moment.";
            else errMsg = "Request failed. Please try again.";

            addMessage("assistant", errMsg);
            setStatus("speaking");
            await speak(errMsg);
            setStatus("idle");
        } finally {
            requestInFlightRef.current = false;
        }
    }, [addMessage, executeAction, speak]);

    const confirmAction = useCallback(async () => {
        if (!pendingAction) return;
        const action = pendingAction;
        setPendingAction(null);
        setStatus("thinking");
        addMessage("user", "Yes, proceed.");
        await executeAction(action);
        setStatus("idle");
    }, [addMessage, executeAction, pendingAction]);

    const cancelAction = useCallback(async () => {
        setPendingAction(null);
        setStatus("speaking");
        const msg = "Action cancelled. Let me know what you want to do next.";
        addMessage("user", "Cancel it.");
        addMessage("assistant", msg);
        await speak(msg);
        setStatus("idle");
    }, [addMessage, speak]);

    const clearMessages = useCallback(() => {
        setMessages([]);
        setPendingAction(null);
        setStatus("idle");
        requestInFlightRef.current = false;
        executionInFlightRef.current = false;
        lastSentRef.current = { text: "", at: 0 };
        lastExecutionRef.current = { fingerprint: "", at: 0 };
        stopSpeaking();
    }, [stopSpeaking]);

    return {
        messages,
        status,
        pendingAction,
        isSpeaking,
        sendMessage,
        confirmAction,
        cancelAction,
        clearMessages,
        speak,
        stopSpeaking,
        setStatus
    };
}
