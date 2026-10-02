import { ReactNode, useState } from 'react';
import { Modal, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, radius, space } from '@/theme';
import type { BoatType, Currency, Equipment } from '@/services';
import { LOCATIONS, MAX_ENGINE_HOURS, type ParsedQuery } from '@tms/shared';
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
  const [f, setF] = useState({ minL: '', maxL: '', minY: '', maxY: '', minP: '', maxP: '', maxH: '' });
  // Sayfa her açıldığında taslak güncel filtreden başlar (etki yerine çizim sırasında, React'in önerdiği biçim).
  const [shownFor, setShownFor] = useState<ParsedQuery | null>(null);
  const opening = visible ? value : null;
  if (opening !== shownFor) {
    setShownFor(opening);
    if (opening) {
      setQ(opening);
      setF({ minL: str(opening.minLength), maxL: str(opening.maxLength), minY: str(opening.minYear), maxY: str(opening.maxYear), minP: str(opening.minPrice), maxP: str(opening.maxPrice), maxH: str(opening.maxEngineHours) });
    }
  }
  const toggleEq = (e: Equipment) => setQ((s) => ({ ...s, equipment: s.equipment.includes(e) ? s.equipment.filter((x) => x !== e) : [...s.equipment, e] }));
  const hours = num(f.maxH);
  const priced = num(f.minP) !== undefined || num(f.maxP) !== undefined;
  const apply = () => onApply({
    equipment: q.equipment, type: q.type, location: q.location, currency: priced ? q.currency ?? 'EUR' : undefined,
    minLength: num(f.minL), maxLength: num(f.maxL), minYear: num(f.minY), maxYear: num(f.maxY), minPrice: num(f.minP), maxPrice: num(f.maxP),
    maxEngineHours: hours === undefined ? undefined : Math.min(Math.round(hours), MAX_ENGINE_HOURS),
    flag: q.flag, tradeIn: q.tradeIn, negotiable: q.negotiable,
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
          <Row>
            <View style={{ flex: 1 }}><Field label={t('listings.min')} value={f.minP} onChangeText={(v) => setF((s) => ({ ...s, minP: v.replace(/\D/g, '') }))} keyboardType="numeric" /></View>
            <View style={{ flex: 1 }}><Field label={t('listings.max')} value={f.maxP} onChangeText={(v) => setF((s) => ({ ...s, maxP: v.replace(/\D/g, '') }))} keyboardType="numeric" placeholder="300000" /></View>
          </Row>
          <Row>{CURS.map((c) => <Chip key={c} label={c} selected={(q.currency ?? 'EUR') === c} onPress={() => setQ((s) => ({ ...s, currency: c }))} />)}</Row>
          <Label text={t('listings.fHours')} />
          <Field label={t('listings.max')} value={f.maxH} onChangeText={(v) => setF((s) => ({ ...s, maxH: v.replace(/\D/g, '') }))} keyboardType="numeric" placeholder="1000" />
          <Label text={t('listings.fFlag')} />
          <Row>
            <Chip label={t('listing.flagTr')} selected={q.flag === 'tr'} onPress={() => setQ((s) => ({ ...s, flag: s.flag === 'tr' ? undefined : 'tr' }))} />
            <Chip label={t('listing.flagForeign')} selected={q.flag === 'foreign'} onPress={() => setQ((s) => ({ ...s, flag: s.flag === 'foreign' ? undefined : 'foreign' }))} />
          </Row>
          <Label text={t('listings.fTerms')} />
          <Row>
            <Chip label={t('listing.tradeIn')} selected={!!q.tradeIn} onPress={() => setQ((s) => ({ ...s, tradeIn: s.tradeIn ? undefined : true }))} />
            <Chip label={t('listing.negotiable')} selected={!!q.negotiable} onPress={() => setQ((s) => ({ ...s, negotiable: s.negotiable ? undefined : true }))} />
          </Row>
          <Label text={t('listings.fLocation')} />
          <Row>{LOCATIONS.map((l) => <Chip key={l} label={l} selected={q.location === l} onPress={() => setQ((s) => ({ ...s, location: s.location === l ? undefined : l }))} />)}</Row>
          <Label text={t('listings.fEquipment')} />
          <Row>{EQUIP.map((e) => <Chip key={e} label={t(`equipment.${e}`)} selected={q.equipment.includes(e)} onPress={() => toggleEq(e)} />)}</Row>
        </ScrollView>
        <View style={{ flexDirection: 'row', gap: space(3), padding: space(4), borderTopWidth: 1, borderColor: colors.line, backgroundColor: colors.card, borderRadius: radius.sm }}>
          <View style={{ flex: 1 }}><Button variant="ghost" title={t('common.clear')} onPress={() => { setQ({ equipment: [] }); setF({ minL: '', maxL: '', minY: '', maxY: '', minP: '', maxP: '', maxH: '' }); }} /></View>
          <View style={{ flex: 2 }}><Button title={t('listings.showResults')} onPress={apply} /></View>
        </View>
      </View>
    </Modal>
  );
}
