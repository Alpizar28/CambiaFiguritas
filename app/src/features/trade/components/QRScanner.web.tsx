import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import jsQR from 'jsqr';

import { colors, radii, spacing } from '../../../constants/theme';

type QRScannerProps = {
  onResult: (raw: string) => void;
  onClose: () => void;
};

type Status = 'init' | 'starting' | 'streaming' | 'denied' | 'unsupported' | 'error';

export function QRScanner({ onResult, onClose }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lockedRef = useRef(false);
  const [status, setStatus] = useState<Status>('init');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const start = async () => {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setStatus('unsupported');
        return;
      }
      setStatus('starting');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          video.setAttribute('playsinline', 'true');
          await video.play().catch(() => {});
        }
        setStatus('streaming');
        scheduleScan();
      } catch (err) {
        const e = err as DOMException;
        if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError') {
          setStatus('denied');
        } else if (e?.name === 'NotFoundError' || e?.name === 'OverconstrainedError') {
          setStatus('error');
          setErrorMsg('No se encontró cámara disponible.');
        } else {
          setStatus('error');
          setErrorMsg(e?.message || 'No pudimos abrir la cámara.');
        }
      }
    };
    start();
    return () => {
      cancelled = true;
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopStream = () => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const scheduleScan = () => {
    rafRef.current = requestAnimationFrame(scanFrame);
  };

  const scanFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || lockedRef.current) {
      rafRef.current = requestAnimationFrame(scanFrame);
      return;
    }
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (w === 0 || h === 0) {
      rafRef.current = requestAnimationFrame(scanFrame);
      return;
    }
    // Downscale para performance — jsQR tolera bien 320-480.
    const maxDim = 480;
    const scale = Math.min(1, maxDim / Math.max(w, h));
    const sw = Math.floor(w * scale);
    const sh = Math.floor(h * scale);
    if (canvas.width !== sw) canvas.width = sw;
    if (canvas.height !== sh) canvas.height = sh;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      rafRef.current = requestAnimationFrame(scanFrame);
      return;
    }
    ctx.drawImage(video, 0, 0, sw, sh);
    const imageData = ctx.getImageData(0, 0, sw, sh);
    const code = jsQR(imageData.data, sw, sh, { inversionAttempts: 'attemptBoth' });
    if (code?.data) {
      lockedRef.current = true;
      try {
        onResult(code.data);
      } finally {
        setTimeout(() => {
          lockedRef.current = false;
        }, 1500);
      }
    }
    rafRef.current = requestAnimationFrame(scanFrame);
  };

  const handleClose = () => {
    stopStream();
    onClose();
  };

  const handleRetry = () => {
    setStatus('init');
    setErrorMsg(null);
    // re-trigger effect via remount: simplemente recargar pidiendo permiso de nuevo.
    setTimeout(() => {
      if (typeof navigator !== 'undefined') {
        navigator.mediaDevices?.getUserMedia({ video: { facingMode: { ideal: 'environment' } } })
          .then((stream) => {
            streamRef.current = stream;
            if (videoRef.current) {
              videoRef.current.srcObject = stream;
              videoRef.current.play().catch(() => {});
            }
            setStatus('streaming');
            scheduleScan();
          })
          .catch(() => setStatus('denied'));
      }
    }, 50);
  };

  return (
    <Modal visible animationType="slide" onRequestClose={handleClose} transparent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Escanear QR</Text>
            <Pressable
              onPress={handleClose}
              hitSlop={12}
              style={({ pressed }) => [pressed && styles.pressed]}
            >
              <Text style={styles.closeText}>Cerrar</Text>
            </Pressable>
          </View>

          {status === 'unsupported' ? (
            <View style={styles.center}>
              <Text style={styles.body}>
                Tu navegador no soporta acceso a cámara. Probá Chrome o Safari recientes, o tipeá el código manualmente.
              </Text>
            </View>
          ) : status === 'denied' ? (
            <View style={styles.center}>
              <Text style={styles.body}>
                Permiso de cámara denegado. Habilitalo en la configuración del navegador y reintentá.
              </Text>
              <Pressable
                onPress={handleRetry}
                style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
              >
                <Text style={styles.btnText}>Reintentar</Text>
              </Pressable>
            </View>
          ) : status === 'error' ? (
            <View style={styles.center}>
              <Text style={styles.body}>{errorMsg ?? 'Error al abrir la cámara.'}</Text>
              <Pressable
                onPress={handleRetry}
                style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
              >
                <Text style={styles.btnText}>Reintentar</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.videoWrap}>
              <video
                ref={videoRef}
                style={videoStyle}
                muted
                autoPlay
                playsInline
              />
              <canvas ref={canvasRef} style={canvasStyle} />
              <View style={styles.overlay} pointerEvents="none">
                <View style={styles.frame} />
              </View>
              {status !== 'streaming' ? (
                <View style={styles.overlayLoader} pointerEvents="none">
                  <ActivityIndicator color={colors.primary} />
                </View>
              ) : null}
              <Text style={styles.hint}>Apuntá al QR del otro coleccionista</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const videoStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  borderRadius: 16,
  background: '#000',
};

const canvasStyle: React.CSSProperties = {
  display: 'none',
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.md,
    width: '100%',
    maxWidth: 480,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  closeText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 15,
  },
  videoWrap: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radii.md,
    overflow: 'hidden',
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    width: '70%',
    aspectRatio: 1,
    borderColor: colors.primary,
    borderWidth: 3,
    borderRadius: radii.md,
  },
  overlayLoader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  hint: {
    position: 'absolute',
    bottom: spacing.md,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowRadius: 4,
  },
  center: {
    paddingVertical: spacing.lg,
    gap: spacing.md,
    alignItems: 'center',
  },
  body: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  },
  btn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.md,
  },
  btnText: {
    color: '#001A0A',
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.85,
  },
});
