import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { decodeCsvBytes } from '@tms/shared';
import { colors, space } from '@/theme';
import { Button, Card, Header, Screen, Section, T } from '@/components';
import { actions, type ImportJob, type ImportPreview } from '@/services/actions';
import { attempt } from '@/services/errors';
import { useRemote } from '@/services/useRemote';
import { shareTextFile } from '@/features/shareFile';

const MAX_CSV = 900_000;

/**
 * Firma toplu ilan yükleme (sitedekiyle aynı akış): şablonu paylaş → CSV seç → önizleme (satır hataları) → başlat →
 * durum birkaç saniyede bir yenilenir. Excel'in UTF-8 ve eski Türkçe (Windows-1254) CSV kaydı ikisi de okunur.
 */
export default function TopluYukleme() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [file, setFile] = useState<{ name: string; csv: string } | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [job, setJob] = useState<ImportJob | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const history = useRemote(() => actions.importJobs(id));

  // Çalışan yükleme 3 sn'de bir yenilenir.
  useEffect(() => {
    if (!job || job.status === 'done' || job.status === 'failed') return;
    const timer = setInterval(() => { void attempt(() => actions.importJob(id, job.id)).then((j) => { if (j) setJob(j); }); }, 3000);
    return () => clearInterval(timer);
  }, [id, job]);

  const errText = (code: string) => {
    const [kind, detail] = code.split(':');
    if (kind === 'photo') return t(`bulk.photo_${detail}`, { defaultValue: t('bulk.photo_failed') });
    if (kind === 'field') return `${t(`bulkFields.${detail}`, { defaultValue: detail })}: ${t('bulk.err_invalid')}`;
    return t(`bulk.err_${detail ?? kind}`, { defaultValue: t(`bulk.${kind}`, { defaultValue: code }) });
  };

  const pick = async () => {
    setMsg(''); setPreview(null); setJob(null);
    const r = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel', 'text/plain'], copyToCacheDirectory: true });
    if (r.canceled || !r.assets[0]) return;
    const a = r.assets[0];
    const csv = decodeCsvBytes(await new File(a.uri).bytes());
    if (csv.length > MAX_CSV) { setMsg(t('bulk.tooLarge')); return; }
    setFile({ name: a.name, csv });
    setBusy(true);
    const p = await attempt(() => actions.importPreview(id, csv));
    setBusy(false);
    if (p) setPreview(p);
  };

  const start = async () => {
    if (!file) return;
    setBusy(true);
    const j = await attempt(() => actions.importStart(id, file.csv));
    setBusy(false);
    if (j) { setJob(j); setPreview(null); void history.reload(); }
  };

  const template = async () => {
    const r = await attempt(() => actions.importTemplate(id));
    if (r) await shareTextFile(r.filename, r.csv, 'text/csv');
  };

  return (
    <Screen>
      <Header title={t('bulk.title')} />
      <Card>
        <T>{t('bulk.intro')}</T>
        <Button variant="secondary" icon="doc" title={t('bulk.template')} onPress={template} />
        <Button icon="plus" title={t('bulk.pick')} loading={busy && !preview} onPress={pick} />
        {file ? <T variant="caption" color={colors.muted}>{t('bulk.fileName', { name: file.name })}</T> : null}
        {msg ? <T variant="caption" color={colors.danger}>{msg}</T> : null}
      </Card>

      {preview ? (
        <Card>
          {preview.missing.length ? <T color={colors.danger}>{t('bulk.missing', { cols: preview.missing.join(', ') })}</T> : null}
          <T variant="h3">{t('bulk.valid', { n: preview.valid })}</T>
          {preview.errors.length ? (
            <View style={{ gap: space(1) }}>
              <T variant="caption" color={colors.danger}>{t('bulk.invalidRows', { n: new Set(preview.errors.map((e) => e.row)).size })}</T>
              {preview.errors.slice(0, 30).map((e, i) => <T key={i} variant="caption">{t('bulk.row', { n: e.row })}: {errText(`${e.field}:${e.code}`)}</T>)}
            </View>
          ) : null}
          <Button title={t('bulk.start', { n: preview.valid })} disabled={busy || preview.valid === 0 || preview.missing.length > 0} loading={busy} onPress={start} />
        </Card>
      ) : null}

      {job ? (
        <Card>
          <T variant="h3">{t(job.status === 'done' ? 'bulk.doneTitle' : 'bulk.runningTitle')}</T>
          <T variant="caption" color={colors.muted}>{t('bulk.progress', { processed: job.processed, total: job.total, created: job.created })}</T>
          {job.failed.length ? (
            <View style={{ gap: space(1) }}>
              <T variant="caption" color={colors.danger}>{t('bulk.failedTitle')}</T>
              {job.failed.slice(0, 30).map((f) => <T key={f.row} variant="caption">{t('bulk.row', { n: f.row })}: {(f.error ?? '').split(',').map(errText).join(' · ')}</T>)}
            </View>
          ) : null}
          {job.status === 'done' ? <T variant="caption" color={colors.muted}>{t('bulk.doneNote')}</T> : null}
        </Card>
      ) : null}

      {history.data?.length ? (
        <Section title={t('bulk.history')}>
          {history.data.map((j) => (
            <Card key={j.id}>
              <T variant="caption">{j.createdAt.slice(0, 16).replace('T', ' ')} · {t('bulk.progress', { processed: j.processed, total: j.total, created: j.created })}</T>
            </Card>
          ))}
        </Section>
      ) : null}
    </Screen>
  );
}
