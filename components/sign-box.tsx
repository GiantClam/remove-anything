import { SignedIn, SignedOut, SignInButton } from "@/components/auth/auth-components";

export default function SignBox(props: {
  children: React.ReactNode;
  noSign?: React.ReactNode;
}) {
  const { children, noSign } = props;

  return (
    <>
      <SignedIn>{children}</SignedIn>
      <SignedOut>
        <SignInButton mode="redirect">{noSign ?? children}</SignInButton>
      </SignedOut>
    </>
  );
}
