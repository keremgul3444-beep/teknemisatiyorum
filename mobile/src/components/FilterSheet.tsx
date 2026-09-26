import { ReactNode, useEffect, useState } from 'react';
import { Modal, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, radius, space } from '@/theme';
import type { BoatType, Currency, Equipment } from '@/services';
import { LOCATIONS, type ParsedQuery } from '@tms/shared';
import { T } from './T';
import { Chip } from './Chip';
import { Field } from './Field';
import { Button } from './Button';
import { Header } from './Header';

const TYPES: BoatType[] = ['motoryat', 'yelkenli', 'katamaran', 'gulet', 'surat', 'balikci'];
const EQUIP: Equipment[] = ['jenerator', 'branda', 'klima', 'radar', 'otopilot', 'bowThruster', 'teak', 'tender'];
const CURS: Currency[] = ['EUR', 'TRY', 'USD'];

const num = (s: string) => (s.trim() === '' || isNaN(Number(s.replace(',', '.'))) ? undefined : Number(s.replace(',', '.')));
const str = (n?: number) => (n === undefined ? '' : String(n));

// Bileşen dışında tanımlı ki her tuşta yeniden bağlanıp klavye odağını kaybetmesin.
function Row({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>{children}</View>;
}
function Label({ text }: { text: string }) {
  return <T variant="h3" style={{ marginTop: space(3) }}>{text}</T>;
}

export function FilterSheet({ visible, value, onClose, onApply }: { visible: boolean; value: ParsedQuery; onClose: () => void; onApply: (q: ParsedQuery) => void }) {
  const { t } = useTranslation();
  const [q, setQ] = useState<ParsedQuery>(value);
  const [f, setF] = useState({ minL: '', maxL: '', minY: '', maxY: '', maxP: '' });
  useEffect(() => {
    if (!visible) return;
    setQ(value);
    setF({ minL: str(value.minLength), maxL: str(value.maxLength), minY: str(value.minYear), maxY: str(value.maxYear), maxP: str(value.maxPrice) });
  }, [visible, value]);
  const toggleEq = (e: Equipment) => setQ((s) => ({ ...s, equipment: s.equipment.includes(e) ? s.equipment.filter((x) => x !== e) : [...s.equipment, e] }));
  const apply = () => onApply({
    equipment: q.equipment, type: q.type, location: q.location, currency: num(f.maxP) !== undefined ? q.currency ?? 'EUR' : undefined,
    minLength: num(f.minL), maxLength: num(f.maxL), minYear: num(f.minY), maxYear: num(f.maxY), maxPrice: num(f.maxP),
  });

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScrollView contentContainerStyle={{ padding: space(5), gap: space(3), paddingTop: space(12) }}>
          <Header title={t('listings.filters')} back={false} right={<Button small variant="ghost" title={t('common.close')} onPress={onClose} />} />
          <Label text={t('listings.fType')} />
          <Row>{TYPES.map((ty) => <Chip key={ty} label={t(`boatType.${ty}`)} selected={q.type === ty} onPress={() => setQ((s) => ({ ...s, type: s.type === ty ? undefined : ty }))} />)}</Row>
          <Label text={t('listings.fLength')} />
          <Row>
            <View style={{ flex: 1 }}><Field label={t('listings.min')} value={f.minL} onChangeText={(v) => setF((s) => ({ ...s, minL: v }))} keyboardType="numeric" /></View>
            <View style={{ flex: 1 }}><Field label={t('listings.max')} value={f.maxL} onChangeText={(v) => setF((s) => ({ ...s, maxL: v }))} keyboardType="numeric" /></View>
          </Row>
          <Label text={t('listings.fYear')} />
          <Row>
            <View style={{ flex: 1 }}><Field label={t('listings.min')} value={f.minY} onChangeText={(v) => setF((s) => ({ ...s, minY: v }))} keyboardType="numeric" maxLength={4} /></View>
            <View style={{ flex: 1 }}><Field label={t('listings.max')} value={f.maxY} onChangeText={(v) => setF((s) => ({ ...s, maxY: v }))} keyboardType="numeric" maxLength={4} /></View>
          </Row>
          <Label text={t('listings.fPrice')} />
          <Field value={f.maxP} onChangeText={(v) => setF((s) => ({ ...s, maxP: v.replace(/\D/g, '') }))} keyboardType="numeric" placeholder="300000" />
          <Row>{CURS.map((c) => <Chip key={c} label={c} selected={(q.currency ?? 'EUR') === c} onPress={() => setQ((s) => ({ ...s, currency: c }))} />)}</Row>
          <Label text={t('listings.fLocation')} />
          <Row>{LOCATIONS.map((l) => <Chip key={l} label={l} selected={q.location === l} onPress={() => setQ((s) => ({ ...s, location: s.location === l ? undefined : l }))} />)}</Row>
          <Label text={t('listings.fEquipment')} />
          <Row>{EQUIP.map((e) => <Chip key={e} label={t(`equipment.${e}`)} selected={q.equipment.includes(e)} onPress={() => toggleEq(e)} />)}</Row>
        </ScrollView>
        <View style={{ flexDirection: 'row', gap: space(3), padding: space(4), borderTopWidth: 1, borderColor: colors.line, backgroundColor: colors.card, borderRadius: radius.sm }}>
          <View style={{ flex: 1 }}><Button variant="ghost" title={t('common.clear')} onPress={() => { setQ({ equipment: [] }); setF({ minL: '', maxL: '', minY: '', maxY: '', maxP: '' }); }} /></View>
          <View style={{ flex: 2 }}><Button title={t('listings.showResults')} onPress={apply} /></View>
        </View>
      </View>
    </Modal>
  );
}
