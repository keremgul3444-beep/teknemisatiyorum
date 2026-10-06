import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, space } from '@/theme';
import { AdminPage, Button, Card, Chip, EmptyState, Field, Loading, T } from '@/components';
import { actions } from '@/services';
import { useRemote } from '@/services/useRemote';
import { attempt } from '@/services/errors';
import { currentLang } from '@/i18n';
import { formatKurus } from '@/features/promo';

const PRODUCTS = ['vitrin_7', 'vitrin_30', 'acil_7', 'acil_30', 'ust_tasi'] as const;
const STATUS_COLOR: Record<string, string> = { paid: colors.success, pending: colors.warning, failed: colors.danger, refunded: colors.muted, cancelled: colors.muted };

/** Yönetim · Siparişler: tüm öne çıkarma siparişleri, havale siparişi oluşturma ve iade (yalnızca yönetici). */
export default function AdminSiparisler() {
  const { t } = useTranslation();
  const orders = useRemote(() => actions.adminOrders());
  const [listingId, setListingId] = useState('');
  const [product, setProduct] = useState<(typeof PRODUCTS)[number]>('vitrin_7');
  const [note, setNote] = useState('');
  const create = () => attempt(async () => {
    await actions.adminManualOrder(listingId.trim(), product, note.trim());
    setListingId(''); setNote('');
    await orders.reload();
  });
  // İade geri alınamaz: önce aynı kartta onay sorulur.
  const [confirming, setConfirming] = useState<string | null>(null);
  const refund = (id: string) => attempt(async () => { await actions.adminRefund(id); setConfirming(null); await orders.reload(); });
  const rows = orders.data ?? [];
  return (
    <AdminPage>
      <Card>
        <T variant="h3">{t('admin.manualOrder')}</T>
        <Field label={t('admin.listingId')} value={listingId} onChangeText={setListingId} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
          {PRODUCTS.map((p) => <Chip key={p} label={t(`promo.product.${p}`)} selected={product === p} onPress={() => setProduct(p)} />)}
        </View>
        <Field label={t('admin.note')} value={note} onChangeText={setNote} maxLength={200} />
        <Button small title={t('admin.create')} disabled={!listingId.trim() || note.trim().length < 3} onPress={create} />
      </Card>
      {orders.loading ? <Loading /> : rows.length === 0 ? <EmptyState icon="lock" title={t('admin.noOrders')} /> : rows.map((o) => (
        <Card key={o.id}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
            <View style={{ flex: 1, gap: space(0.5) }}>
              <T variant="bodySemi">{o.listingTitle ?? o.listingId}</T>
              <T variant="caption" color={colors.muted}>
                {t(`promo.product.${o.productCode}`, { defaultValue: o.productCode })} · {t(`admin.channel.${o.channel}`)}{o.userName ? ` · ${o.userName}` : ''}
              </T>
              {o.note ? <T variant="caption" color={colors.muted}>{o.note}</T> : null}
              <T variant="caption" color={STATUS_COLOR[o.status] ?? colors.muted}>{t(`admin.orderStatus.${o.status}`)}</T>
            </View>
            <View style={{ alignItems: 'flex-end', gap: space(1) }}>
              <T variant="h3">{formatKurus(o.amountKurus, currentLang())}</T>
              {o.status === 'paid' && confirming !== o.id ? <Button small variant="ghost" title={t('admin.refund')} onPress={() => setConfirming(o.id)} /> : null}
            </View>
          </View>
          {o.status === 'paid' && confirming === o.id ? (
            <View style={{ gap: space(2), marginTop: space(2) }}>
              <T variant="caption">{t('admin.refundConfirm')}</T>
              <View style={{ flexDirection: 'row', gap: space(2) }}>
                <View style={{ flex: 1 }}><Button small variant="ghost" title={t('common.cancel')} onPress={() => setConfirming(null)} /></View>
                <View style={{ flex: 1 }}><Button small variant="danger" title={t('admin.refundYes')} onPress={() => refund(o.id)} /></View>
              </View>
            </View>
          ) : null}
        </Card>
      ))}
    </AdminPage>
  );
}
