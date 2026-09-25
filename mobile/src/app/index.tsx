import { Redirect } from 'expo-router';
import { useSession } from '@/session/role';

export default function Index() {
  const onboarded = useSession((s) => s.onboarded);
  return <Redirect href={onboarded ? '/kesfet' : '/onboarding'} />;
}
