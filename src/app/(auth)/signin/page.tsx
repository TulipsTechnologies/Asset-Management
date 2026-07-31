import { Suspense } from 'react';
import Signin from './Signin';

const Page = () => {
  return (
    <Suspense>
      <Signin />
    </Suspense>
  );
};

export default Page;
