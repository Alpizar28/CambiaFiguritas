import { Alert, Linking, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { track } from '../../../services/analytics';
import type { AppUser } from '../../../types/user';
import type { CountryCompare } from './countryComparison';

const PREVIEW_LIMIT = 10;

function flatten(rows: CountryCompare[], side: 'iNeedFromThem' | 'theyNeedFromMe'): string[] {
  return rows.flatMap((row) => row[side]);
}

export function buildWhatsAppMessage(myName: string | undefined, rows: CountryCompare[]): string {
  const iNeed = flatten(rows, 'iNeedFromThem');
  const theyNeed = flatten(rows, 'theyNeedFromMe');

  const previewIneed = iNeed.slice(0, PREVIEW_LIMIT).join(', ');
  const previewIgive = theyNeed.slice(0, PREVIEW_LIMIT).join(', ');
  const ineedRest = iNeed.length > PREVIEW_LIMIT ? ` y ${iNeed.length - PREVIEW_LIMIT} más` : '';
  const igiveRest = theyNeed.length > PREVIEW_LIMIT ? ` y ${theyNeed.length - PREVIEW_LIMIT} más` : '';

  const lines = [
    `Hola! Soy ${myName ?? 'un coleccionista'} de CambiaFiguritas.`,
    `Tenemos ${iNeed.length + theyNeed.length} figus para intercambiar.`,
  ];

  if (theyNeed.length > 0) {
    lines.push('', `Te puedo dar (${theyNeed.length}): ${previewIgive}${igiveRest}`);
  }
  if (iNeed.length > 0) {
    lines.push('', `Necesito (${iNeed.length}): ${previewIneed}${ineedRest}`);
  }
  lines.push('', '¿Coordinamos?');
  return lines.join('\n');
}

export function buildClipboardText(rows: CountryCompare[]): string {
  const lines: string[] = [];
  const twoWay = rows.filter((r) => r.iNeedFromThem.length > 0 || r.theyNeedFromMe.length > 0);

  lines.push('=== Intercambio CambiaFiguritas ===', '');
  for (const row of twoWay) {
    if (row.iNeedFromThem.length === 0 && row.theyNeedFromMe.length === 0) continue;
    lines.push(`[${row.countryName}]`);
    if (row.theyNeedFromMe.length > 0) {
      lines.push(`  Le doy: ${row.theyNeedFromMe.join(', ')}`);
    }
    if (row.iNeedFromThem.length > 0) {
      lines.push(`  Me da: ${row.iNeedFromThem.join(', ')}`);
    }
    lines.push('');
  }

  const totalIneed = twoWay.reduce((acc, r) => acc + r.iNeedFromThem.length, 0);
  const totalIgive = twoWay.reduce((acc, r) => acc + r.theyNeedFromMe.length, 0);
  lines.push(`Total: ${totalIgive} le doy, ${totalIneed} me da.`);

  return lines.join('\n');
}

export function openWhatsApp(user: AppUser, message: string) {
  const phone = user.whatsapp?.replace(/\D/g, '');
  if (!phone) return;
  track({ name: 'match_whatsapp_clicked', params: { matchUid: user.uid } });
  Linking.openURL(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`);
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await Clipboard.setStringAsync(text);
    return true;
  } catch {
    return false;
  }
}

// Por privacidad, prioriza buscar por nombre de ciudad (texto). Solo si no hay
// ciudad cargada, cae a las coords bucketeadas (~1km de precisión, no exactas).
export function openMapsForUser(user: AppUser): boolean {
  if (user.city && user.city.trim().length > 0) {
    track({ name: 'match_map_clicked', params: { matchUid: user.uid } });
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(user.city)}`);
    return true;
  }
  if (user.lat != null && user.lng != null) {
    // Las coords están bucketeadas a ~5km, así que el pin no es exacto.
    // Usamos zoom 12 para mostrar área (~5-10 km visibles) en lugar de calle puntual.
    const q = `${user.lat},${user.lng}`;
    track({ name: 'match_map_clicked', params: { matchUid: user.uid } });
    Linking.openURL(`https://www.google.com/maps/@${q},12z`);
    return true;
  }
  return false;
}

export async function reportUser(
  reporterUid: string,
  targetUid: string,
  reason: string,
): Promise<void> {
  await addDoc(collection(db, 'reports'), {
    reporterUid,
    targetUid,
    reason: reason.slice(0, 500),
    createdAt: serverTimestamp(),
  });
  track({ name: 'match_reported', params: { targetUid } });
}

export function promptReport(
  reporterUid: string,
  target: AppUser,
  onDone: (ok: boolean, message: string) => void,
) {
  if (Platform.OS === 'web') {
    const reason = typeof window !== 'undefined' ? window.prompt(`¿Por qué reportás a ${target.name}?`) : null;
    if (reason == null) return;
    if (reason.trim().length === 0) {
      onDone(false, 'Necesitás escribir un motivo.');
      return;
    }
    reportUser(reporterUid, target.uid, reason.trim())
      .then(() => onDone(true, 'Reporte enviado. Gracias.'))
      .catch(() => onDone(false, 'No se pudo enviar el reporte.'));
    return;
  }

  if (typeof Alert.prompt === 'function') {
    Alert.prompt(
      'Reportar usuario',
      `¿Por qué reportás a ${target.name}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Enviar',
          style: 'destructive',
          onPress: (reason?: string) => {
            if (!reason || reason.trim().length === 0) {
              onDone(false, 'Necesitás escribir un motivo.');
              return;
            }
            reportUser(reporterUid, target.uid, reason.trim())
              .then(() => onDone(true, 'Reporte enviado. Gracias.'))
              .catch(() => onDone(false, 'No se pudo enviar el reporte.'));
          },
        },
      ],
      'plain-text',
    );
    return;
  }

  Alert.alert(
    'Reportar usuario',
    `¿Querés reportar a ${target.name}? Esto se enviará al equipo para revisión.`,
    [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Enviar',
        style: 'destructive',
        onPress: () => {
          reportUser(reporterUid, target.uid, 'Reporte sin motivo (Android prompt no disponible)')
            .then(() => onDone(true, 'Reporte enviado. Gracias.'))
            .catch(() => onDone(false, 'No se pudo enviar el reporte.'));
        },
      },
    ],
  );
}
