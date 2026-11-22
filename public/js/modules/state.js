// state.js — Estado Compartido del Dashboard
export const state = {
  treatments: [],
  currentAgendaDate: '',
  editingApptId: null,
  recentlyMovedApptId: null,
  selectedPatientId: null,
  activeClinicalApptId: null,
  currentView: 'day', // 'day' o 'week'
  clinicHours: null,
  weekDaysDates: [],
  currentOdontogramaState: {},
  activeOdontogramaTool: 'sano',
  isPatCiDuplicated: false,
  isQuickPatCiDuplicated: false,
  isPatPhoneInvalid: false,
  isQuickPatPhoneInvalid: false,
  isApptPhoneInvalid: false,
  activeFichaEvolution: [],
  filteredToothId: null
};
