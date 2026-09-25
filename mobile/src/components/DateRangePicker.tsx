import { Pressable, View } from 'react-native';
import { colors, radius, space, fonts } from '@/theme';
import { T } from './T';

export interface DateRange { start: string; days: number }

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12);

/** Önümüzdeki 28 günden başlangıç + bitiş seçtiren basit ızgara. */
export function DateRangePicker({ value, onChange, lang }: { value: DateRange | null; onChange: (r: DateRange) => void; lang: 'tr' | 'en' }) {
  const today = addDays(new Date(), 1);
  const days = Array.from({ length: 28 }, (_, i) => addDays(today, i));
  const startIdx = value ? days.findIndex((d) => iso(d) === value.start) : -1;
  const endIdx = startIdx >= 0 && value ? startIdx + value.days - 1 : -1;
  const pick = (i: number) => {
    if (startIdx < 0 || value!.days > 1 || i < startIdx) onChange({ start: iso(days[i]), days: 1 });
    else onChange({ start: value!.start, days: i - startIdx + 1 });
  };
  const wd = new Intl.DateTimeFormat(lang === 'tr' ? 'tr-TR' : 'en-US', { weekday: 'short' });
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(1.5) }}>
      {days.map((d, i) => {
        const inRange = i >= startIdx && i <= endIdx;
        const edge = i === startIdx || i === endIdx;
        return (
          <Pressable key={i} onPress={() => pick(i)}
            style={{ width: '12.8%', aspectRatio: 0.8, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center',
              backgroundColor: edge ? colors.primary : inRange ? colors.primarySoft : colors.card, borderWidth: 1, borderColor: colors.line }}>
            <T variant="caption" color={inRange ? colors.white : colors.muted} style={{ fontSize: 9 }}>{wd.format(d)}</T>
            <T variant="caption" color={inRange ? colors.white : colors.text} style={{ fontFamily: fonts.bodyBold }}>{d.getDate()}</T>
          </Pressable>
        );
      })}
    </View>
  );
}
