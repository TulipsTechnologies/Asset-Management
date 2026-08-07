import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { IAdminUserData } from '@tulipstechnologies/common/dist/interface/IAdminUser';
import { setStoredAdminView } from '@tulipstechnologies/common/dist/utils/adminViewStorage';

export interface IAuthState {
  token: string | null;
  /** Full HRM hub user used by the shared Header/Sidebar. */
  currentUser: IAdminUserData | null;
  adminView: boolean;
  profileImage: string | null;
  companyLogo: string | null;
}

const initialState: IAuthState = {
  token: null,
  currentUser: null,
  adminView: false,
  profileImage: null,
  companyLogo: null,
};

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAuthToken: (state, action: PayloadAction<string | null>) => {
      state.token = action.payload;
    },
    setCurrentUser: (state, action: PayloadAction<IAdminUserData | null>) => {
      state.currentUser = action.payload;
    },
    setAdminView: (state, action: PayloadAction<boolean>) => {
      state.adminView = action.payload;
      try {
        // Shared across the sibling modules on this domain, so the toggle
        // survives navigating out of asset-management and back.
        setStoredAdminView(action.payload);
      } catch {
        // persistence must not block the view toggle
      }
    },
    setProfileImage: (state, action: PayloadAction<string | null>) => {
      state.profileImage = action.payload;
    },
    setCompanyLogo: (state, action: PayloadAction<string | null>) => {
      state.companyLogo = action.payload;
    },
  },
});

export const {
  setAuthToken,
  setCurrentUser,
  setAdminView,
  setProfileImage,
  setCompanyLogo,
} = authSlice.actions;
export default authSlice.reducer;
