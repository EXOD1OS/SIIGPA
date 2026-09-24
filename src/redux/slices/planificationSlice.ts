import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type PlanifTab = 'PAAC' | 'PAAD' | 'PEDAGOGICO' | 'DISCIPLINAR' | 'GENERAL';

interface PlanifState {
  selectedCarreraId: string | null;
  activePlanifId: string | null;
  currentDocumentType: PlanifTab;
  activeObservations: Record<string, string[]>;
}

const initialState: PlanifState = {
  selectedCarreraId: null,
  activePlanifId: null,
  currentDocumentType: 'PAAC',
  activeObservations: {},
};

export const planificationSlice = createSlice({
  name: 'planification',
  initialState,
  reducers: {
    setSelectedCarreraId: (state, action: PayloadAction<string | null>) => {
      state.selectedCarreraId = action.payload;
    },
    setActivePlanificacion: (state, action: PayloadAction<string | null>) => {
      state.activePlanifId = action.payload;
    },
    setDocumentType: (state, action: PayloadAction<PlanifTab>) => {
      state.currentDocumentType = action.payload;
    },
    setFieldObservation: (state, action: PayloadAction<{ path: string; message: string }>) => {
      if (!state.activeObservations[action.payload.path]) state.activeObservations[action.payload.path] = [];
      state.activeObservations[action.payload.path].push(action.payload.message);
    },
    resolveFieldObservation: (state, action: PayloadAction<string>) => {
      delete state.activeObservations[action.payload];
    },
  },
});

export const {
  setSelectedCycle,
  setSelectedCarreraId,
  setActivePlanificacion,
  setDocumentType,
  setFieldObservation,
  resolveFieldObservation,
} = planificationSlice.actions;

export default planificationSlice.reducer;
