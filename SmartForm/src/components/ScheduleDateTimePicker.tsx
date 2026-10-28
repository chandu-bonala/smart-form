import React, { useEffect, useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

type Props = {
  visible: boolean;
  title: string;
  confirmLabel: string;
  initialDate?: Date | null;
  onCancel: () => void;
  onConfirm: (date: Date) => void;
};

const ui = {
  ink: '#171429',
  muted: '#716C87',
  line: '#E3D8FF',
  surface: '#FBF7FF',
  surfaceSoft: '#F4EEFF',
  blue: '#7657F7',
  blueSoft: '#ECE9FF',
  page: '#F0E8FF',
};

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const pad = (value: number) => `${value}`.padStart(2, '0');

const toTwelveHour = (hour24: number) => {
  const normalized = hour24 % 24;
  return {
    hour: normalized % 12 === 0 ? 12 : normalized % 12,
    period: normalized >= 12 ? ('PM' as const) : ('AM' as const),
  };
};

const toTwentyFourHour = (hour12: number, period: 'AM' | 'PM') => {
  if (period === 'AM') {
    return hour12 === 12 ? 0 : hour12;
  }
  return hour12 === 12 ? 12 : hour12 + 12;
};

const clampToHourSlot = (date: Date) => {
  const next = new Date(date);
  next.setMinutes(next.getMinutes() >= 30 ? 30 : 0, 0, 0);
  return next;
};

const addMonths = (date: Date, delta: number) => new Date(date.getFullYear(), date.getMonth() + delta, 1);

const buildMonthDays = (month: Date) => {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: Array<Date | null> = [];

  for (let index = 0; index < startOffset; index += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(month.getFullYear(), month.getMonth(), day));
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
};

const formatSummaryDate = (date: Date) =>
  date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

const formatSummaryTime = (date: Date) =>
  date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

const formatExactTime = (date: Date) => {
  const clock = toTwelveHour(date.getHours());
  return `${pad(clock.hour)}:${pad(date.getMinutes())} ${clock.period}`;
};

export const ScheduleDateTimePicker: React.FC<Props> = ({
  visible,
  title,
  confirmLabel,
  initialDate,
  onCancel,
  onConfirm,
}) => {
  const defaultDate = initialDate ? new Date(initialDate) : new Date();
  const defaultStart = useMemo(() => {
    const next = initialDate ? new Date(initialDate) : new Date();
    next.setHours(next.getHours() + 1, 0, 0, 0);
    return clampToHourSlot(next);
  }, [initialDate]);

  const [month, setMonth] = useState(() => new Date(defaultDate.getFullYear(), defaultDate.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<Date>(new Date(defaultStart));
  const defaultClock = toTwelveHour(defaultStart.getHours());
  const [selectedHour, setSelectedHour] = useState(defaultClock.hour);
  const [selectedMinute, setSelectedMinute] = useState(defaultStart.getMinutes());
  const [selectedPeriod, setSelectedPeriod] = useState<'AM' | 'PM'>(defaultClock.period);
  const [activePanel, setActivePanel] = useState<'calendar' | 'time'>('calendar');

  useEffect(() => {
    if (!visible) return;
    const seed = initialDate ? new Date(initialDate) : new Date();
    seed.setHours(seed.getHours() + 1, 0, 0, 0);
    const next = clampToHourSlot(seed);
    setMonth(new Date(seed.getFullYear(), seed.getMonth(), 1));
    setSelectedDate(next);
    const clock = toTwelveHour(next.getHours());
    setSelectedHour(clock.hour);
    setSelectedMinute(next.getMinutes());
    setSelectedPeriod(clock.period);
    setActivePanel('calendar');
  }, [initialDate, visible]);

  const cells = useMemo(() => buildMonthDays(month), [month]);
  const selected = useMemo(() => {
    const next = new Date(selectedDate);
    next.setHours(toTwentyFourHour(selectedHour, selectedPeriod), selectedMinute, 0, 0);
    return next;
  }, [selectedDate, selectedHour, selectedMinute, selectedPeriod]);
  const isSameDay = (left: Date, right: Date) =>
    left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
  const hourOptions = useMemo(() => Array.from({ length: 12 }, (_, index) => index + 1), []);
  const minuteOptions = useMemo(() => Array.from({ length: 60 }, (_, index) => index), []);
  const periodOptions: Array<'AM' | 'PM'> = ['AM', 'PM'];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <ScrollView
            style={styles.bodyScroll}
            contentContainerStyle={styles.bodyScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.header}>
              <View style={styles.headerCopy}>
                <View style={styles.badge}>
                  <Feather name="calendar" size={14} color={ui.blue} />
                  <Text style={styles.badgeText}>{title}</Text>
                </View>
                <Text style={styles.heading}>{formatSummaryDate(selected)}</Text>
                <Text style={styles.subheading}>{formatSummaryTime(selected)}</Text>
              </View>
              <TouchableOpacity onPress={onCancel} style={styles.iconButton}>
                <Feather name="x" size={18} color={ui.ink} />
              </TouchableOpacity>
            </View>

            <View style={styles.summaryCard}>
              <View style={styles.summaryGrid}>
                <View style={styles.summaryTile}>
                  <Text style={styles.summaryLabel}>Date</Text>
                  <Text style={styles.summaryValue}>{selected.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}</Text>
                </View>
                <View style={styles.summaryTile}>
                  <Text style={styles.summaryLabel}>Day</Text>
                  <Text style={styles.summaryValue}>{selected.toLocaleDateString([], { weekday: 'long' })}</Text>
                </View>
                <View style={styles.summaryTile}>
                  <Text style={styles.summaryLabel}>Time</Text>
                  <Text style={styles.summaryValue}>{formatExactTime(selected)}</Text>
                </View>
              </View>
            </View>

            <View style={styles.modeSwitch}>
              <TouchableOpacity
                style={[styles.modeButton, activePanel === 'calendar' ? styles.modeButtonActive : null]}
                onPress={() => setActivePanel('calendar')}
              >
                <Feather name="calendar" size={15} color={activePanel === 'calendar' ? '#fff' : ui.ink} />
                <Text style={[styles.modeButtonText, activePanel === 'calendar' ? styles.modeButtonTextActive : null]}>Calendar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeButton, activePanel === 'time' ? styles.modeButtonActive : null]}
                onPress={() => setActivePanel('time')}
              >
                <Feather name="clock" size={15} color={activePanel === 'time' ? '#fff' : ui.ink} />
                <Text style={[styles.modeButtonText, activePanel === 'time' ? styles.modeButtonTextActive : null]}>Time</Text>
              </TouchableOpacity>
            </View>

            {activePanel === 'calendar' ? (
              <>
                <View style={styles.monthBar}>
                  <TouchableOpacity style={styles.monthButton} onPress={() => setMonth((current) => addMonths(current, -1))}>
                    <Feather name="chevron-left" size={18} color={ui.blue} />
                  </TouchableOpacity>
                  <Text style={styles.monthLabel}>
                    {month.toLocaleDateString([], { month: 'long', year: 'numeric' })}
                  </Text>
                  <TouchableOpacity style={styles.monthButton} onPress={() => setMonth((current) => addMonths(current, 1))}>
                    <Feather name="chevron-right" size={18} color={ui.blue} />
                  </TouchableOpacity>
                </View>

                <View style={styles.weekdayRow}>
                  {WEEKDAYS.map((weekday) => (
                    <Text key={weekday} style={styles.weekday}>
                      {weekday}
                    </Text>
                  ))}
                </View>

                <View style={styles.calendarGrid}>
                  {cells.map((date, index) => {
                    if (!date) {
                      return <View key={`empty-${index}`} style={styles.dayCell} />;
                    }
                    const active = isSameDay(date, selected);
                    return (
                      <TouchableOpacity
                        key={date.toISOString()}
                        style={[styles.dayCell, active ? styles.dayCellActive : null]}
                        onPress={() => setSelectedDate(date)}
                      >
                        <Text style={[styles.dayText, active ? styles.dayTextActive : null]}>{date.getDate()}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            ) : (
              <>
                <Text style={styles.sectionLabel}>Pick Time</Text>
                <View style={styles.timePickerRow}>
                  <View style={styles.timeWheel}>
                    <Text style={styles.wheelLabel}>Hour</Text>
                    <ScrollView
                      style={styles.wheelScroll}
                      contentContainerStyle={styles.wheelScrollContent}
                      showsVerticalScrollIndicator={false}
                      nestedScrollEnabled
                    >
                      {hourOptions.map((hour) => {
                        const active = selectedHour === hour;
                        return (
                          <TouchableOpacity
                            key={`hour-${hour}`}
                            style={[styles.wheelItem, active ? styles.wheelItemActive : null]}
                            onPress={() => setSelectedHour(hour)}
                          >
                            <Text style={[styles.wheelItemText, active ? styles.wheelItemTextActive : null]}>
                              {pad(hour)}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>

                  <View style={styles.timeWheel}>
                    <Text style={styles.wheelLabel}>Minute</Text>
                    <ScrollView
                      style={styles.wheelScroll}
                      contentContainerStyle={styles.wheelScrollContent}
                      showsVerticalScrollIndicator={false}
                      nestedScrollEnabled
                    >
                      {minuteOptions.map((minute) => {
                        const active = selectedMinute === minute;
                        return (
                          <TouchableOpacity
                            key={`minute-${minute}`}
                            style={[styles.wheelItem, active ? styles.wheelItemActive : null]}
                            onPress={() => setSelectedMinute(minute)}
                          >
                            <Text style={[styles.wheelItemText, active ? styles.wheelItemTextActive : null]}>
                              {pad(minute)}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>

                  <View style={styles.timeWheel}>
                    <Text style={styles.wheelLabel}>AM / PM</Text>
                    <ScrollView
                      style={styles.wheelScroll}
                      contentContainerStyle={styles.wheelScrollContent}
                      showsVerticalScrollIndicator={false}
                      nestedScrollEnabled
                    >
                      {periodOptions.map((period) => {
                        const active = selectedPeriod === period;
                        return (
                          <TouchableOpacity
                            key={period}
                            style={[styles.wheelItem, active ? styles.wheelItemActive : null]}
                            onPress={() => setSelectedPeriod(period)}
                          >
                            <Text style={[styles.wheelItemText, active ? styles.wheelItemTextActive : null]}>{period}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                </View>
              </>
            )}
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.secondaryButton} onPress={onCancel}>
              <Text style={styles.secondaryText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryButton} onPress={() => onConfirm(selected)}>
              <Feather name="check" size={16} color="#fff" />
              <Text style={styles.primaryText}>{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.48)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 14,
  },
  card: {
    flex: 1,
    width: '100%',
    maxWidth: 620,
    maxHeight: '92%',
    alignSelf: 'center',
    overflow: 'hidden',
    backgroundColor: ui.surface,
    borderRadius: 28,
    padding: 18,
    shadowColor: 'rgba(49, 34, 111, 0.16)',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  bodyScroll: {
    width: '100%',
    flex: 1,
  },
  bodyScrollContent: {
    paddingBottom: 12,
  },
  headerCopy: { flex: 1, paddingRight: 10 },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(118, 87, 247, 0.10)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 10,
  },
  badgeText: { color: ui.blue, fontWeight: '900', marginLeft: 6, fontSize: 12 },
  heading: { color: ui.ink, fontSize: 22, fontWeight: '900', lineHeight: 28 },
  subheading: { color: ui.muted, marginTop: 4, fontWeight: '700' },
  summaryCard: {
    borderRadius: 18,
    backgroundColor: ui.surfaceSoft,
    padding: 12,
    marginBottom: 10,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  summaryTile: {
    flexGrow: 1,
    minWidth: 150,
    backgroundColor: ui.surface,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  summaryLabel: { color: ui.muted, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.6 },
  summaryValue: { color: ui.ink, fontSize: 13, fontWeight: '900', marginTop: 4 },
  modeSwitch: {
    flexDirection: 'row',
    borderRadius: 18,
    backgroundColor: ui.surfaceSoft,
    padding: 4,
    marginBottom: 10,
  },
  modeButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    backgroundColor: 'transparent',
  },
  modeButtonActive: {
    backgroundColor: ui.blue,
    shadowColor: 'rgba(118, 87, 247, 0.24)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 3,
  },
  modeButtonText: {
    color: ui.ink,
    fontWeight: '800',
    marginLeft: 6,
  },
  modeButtonTextActive: { color: '#fff' },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(118, 87, 247, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    backgroundColor: ui.surfaceSoft,
    borderRadius: 16,
    padding: 8,
  },
  monthButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: ui.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabel: { color: ui.ink, fontWeight: '900', fontSize: 15, flex: 1, textAlign: 'center' },
  weekdayRow: { flexDirection: 'row', marginBottom: 6 },
  weekday: { flex: 1, textAlign: 'center', color: ui.muted, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 },
  dayCell: {
    width: `${100 / 7}%`,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    marginBottom: 2,
  },
  dayCellActive: {
    backgroundColor: ui.blue,
    shadowColor: 'rgba(118, 87, 247, 0.32)',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 18,
    elevation: 4,
  },
  dayText: { color: ui.ink, fontWeight: '800', fontSize: 13 },
  dayTextActive: { color: '#fff' },
  sectionLabel: {
    color: ui.muted,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  timePickerRow: { flexDirection: 'row', gap: 10, marginBottom: 6 },
  timeWheel: { flex: 1, minWidth: 88 },
  wheelLabel: { color: ui.muted, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.8 },
  wheelScroll: { maxHeight: 140, borderRadius: 16, backgroundColor: ui.surfaceSoft },
  wheelScrollContent: { paddingVertical: 8, paddingHorizontal: 8 },
  wheelItem: {
    minHeight: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    backgroundColor: 'transparent',
  },
  wheelItemActive: {
    backgroundColor: ui.blue,
  },
  wheelItemText: {
    color: ui.ink,
    fontWeight: '800',
    fontSize: 13,
  },
  wheelItemTextActive: { color: '#fff' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 10 },
  secondaryButton: {
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: ui.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginRight: 10,
  },
  secondaryText: { color: ui.ink, fontWeight: '800' },
  primaryButton: {
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: ui.blue,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    flexDirection: 'row',
  },
  primaryText: { color: '#fff', fontWeight: '900', marginLeft: 8 },
});
