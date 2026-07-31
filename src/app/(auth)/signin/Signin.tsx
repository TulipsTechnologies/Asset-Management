'use client';
import C from './SignIn.module.scss';
import Input from '@/components/UI/Input';
import { FormEvent, useEffect, useRef, useState } from 'react';
import AuthLayout from '@/components/Layout/AuthLayout/AuthLayout';

import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/Providers/ToastProvider';
import { useRouter, useSearchParams } from 'next/navigation';
import { parseJwt, signIn } from '@/services/auth.service';
import { IUser } from '@/interface/IUser';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { LoadingSvg } from '@tulipstechnologies/common';

const Signin = () => {
  const searchParams = useSearchParams();
  const userNameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [rememberMe, setRememberMe] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { addToast } = useToast();
  const router = useRouter();
  const { setSessionData } = useAuth();
  const handleError = useErrorHandler();

  const handleInputChange = (e: FormEvent) => {
    const { name, value } = e.target as HTMLInputElement;
    if (name === 'userName' && userNameRef.current) {
      userNameRef.current.value = value;
    }

    if (name === 'password' && passwordRef.current) {
      passwordRef.current.value = value;
    }
  };

  useEffect(() => {
    const savedUserName = localStorage.getItem('remembered_username');
    if (savedUserName && userNameRef.current) {
      userNameRef.current.value = savedUserName;
      setRememberMe(true);
    }
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!userNameRef.current?.value) {
      addToast.error('Username is required');
      return;
    }

    if (!passwordRef.current?.value) {
      addToast.error('Password is required');
      return;
    }

    setIsSubmitting(true);
    const res = await signIn({
      userName: userNameRef.current.value,
      password: passwordRef.current.value,
    });

    if (res.success && res.statusCode === 200 && res.data?.token) {
      const token = res.data.token;
      const parsedData = parseJwt(token);

      if (!parsedData) {
        addToast.error('Invalid token');
        setIsSubmitting(false);
        return;
      }

      const newUser: IUser = {
        userId: res.data.userId ?? parsedData.userId ?? 0,
        fullName:
          res.data.fullName ??
          parsedData.fullName ??
          userNameRef.current.value,
        email: res.data.email ?? parsedData.email ?? userNameRef.current.value,
        userName: userNameRef.current.value,
        companyId:
          typeof res.data.companyId === 'string' ? res.data.companyId : null,
      };

      await setSessionData(token, newUser);

      if (rememberMe) {
        localStorage.setItem('remembered_username', userNameRef.current.value);
      } else {
        localStorage.removeItem('remembered_username');
      }
      setIsSubmitting(false);
      const redirect = searchParams.get('redirect');
      router.replace(redirect || '/dashboard');
    } else {
      handleError(res);
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      formContent={
        <>
          <h2 className="text-xl font-bold">Welcome back to TulipsHRM!</h2>
          <p className="text-base text-gray-500">
            Please sign in to access the asset management workspace.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="space-y-5">
              <Input
                ref={userNameRef}
                type="text"
                name="userName"
                placeholder="Username"
                icon={<i className="icon icon-user"></i>}
                onChange={handleInputChange}
                allowSubmitOnEnter={true}
                required
              />

              <div className={C.customContent}>
                <div className={C.contentLeft}>
                  <Input
                    ref={passwordRef}
                    type="password"
                    name="password"
                    placeholder="Password"
                    icon={<i className="icon icon-lock"></i>}
                    onChange={handleInputChange}
                    allowSubmitOnEnter={true}
                    required
                  />
                </div>
              </div>

              <div className="flex justify-between items-center gap-2">
                <label
                  htmlFor="rememberMe"
                  className="text-sm text-gray-600 space-x-2 flex items-center"
                >
                  <input
                    type="checkbox"
                    id="rememberMe"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 border-gray-300 text-primarycolor"
                  />
                  <span>Remember me</span>
                </label>
              </div>
            </div>

            <button
              type="submit"
              className={`mt-8 ${C.btn} ${C.green}`}
              disabled={isSubmitting}
            >
              {isSubmitting ? <LoadingSvg bgColor="white" /> : 'SIGN IN'}
            </button>
          </form>
        </>
      }
    />
  );
};

export default Signin;
