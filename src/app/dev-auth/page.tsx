import { Suspense } from 'react';
import DevAuth from './DevAuth';

const Page = () => {
  return (
    <Suspense>
      <DevAuth />
    </Suspense>
  );
};

export default Page;
