import Image from "next/image";
import Logo from "../../../../public/logo.svg";
import Bolb from "../../../../public/graphics/graphic1.svg";
import Flower from "../../../../public/graphics/logo-flower.svg";
import C from "./AuthLayout.module.scss";
import { ReactNode } from "react";

const AuthLayout = ({
  formContent,
  extraContent,
  containerClassName,
}: {
  formContent: ReactNode;
  extraContent?: ReactNode;
  containerClassName?: string;
}) => {
  return (
    <div className={`${C.container}`}>
      <div className="relative overflow-hidden">
        <div className="container mx-auto flex flex-col items-center justify-between min-h-screen h-auto py-10">
          <header className="w-full">
            <a href="https://tulipshrm.com" className="logo">
              <Image
                alt="TulipsHRM Logo"
                src={Logo}
                className={`max-w-[300px] max-h-[90px] h-auto object-contain object-left relative z-10`}
                priority
              />
            </a>
          </header>
          <div className={C.auth}>
            <div className={`${C.authForm} ${containerClassName ?? ""}`}>
              {formContent}
            </div>
            {extraContent && <div className={C.extra}>{extraContent}</div>}
          </div>
          <div className={C.copyrights}>
            <p>
              © 2008-2026 |{" "}
              <a href="https://tulipstechnologies.com" target="_blank">
                tulipstechnologies.com
              </a>
            </p>
          </div>
        </div>
        <Image alt="Blob Graphic" src={Bolb} className={C.blob} />
        <Image alt="Flower Graphic" src={Flower} className={C.flower} />
      </div>
    </div>
  );
};

export default AuthLayout;
