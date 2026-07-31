import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { IUser } from '@/interface/IUser';

export interface IAuthState {
  token: string | null;
  currentUser: IUser | null;
}

const initialState: IAuthState = {
  token: null,
  currentUser: null,
};

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAuthToken: (state, action: PayloadAction<string | null>) => {
      state.token = action.payload;
    },
    setCurrentUser: (state, action: PayloadAction<IUser | null>) => {
      state.currentUser = action.payload;
    },
  },
});

export const { setAuthToken, setCurrentUser } = authSlice.actions;
export default authSlice.reducer;
