import { Text } from 'react-native';
import { act, render } from '@testing-library/react-native';
import { usePolling } from '@/services/usePolling';
import { useMode } from '@/services/mode';

function Probe({ fn, on = true }: { fn: () => Promise<void>; on?: boolean }) {
  usePolling(fn, 5000, on);
  return <Text>x</Text>;
}

const tick = () => act(async () => { jest.advanceTimersByTime(5000); });

describe('usePolling', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => { jest.useRealTimers(); useMode.setState({ mode: 'demo' }); });

  it('api modunda aralıklarla çağırır, ekran kapanınca durur', async () => {
    useMode.setState({ mode: 'api' });
    const fn = jest.fn(async () => {});
    const r = await render(<Probe fn={fn} />);
    await tick(); await tick();
    expect(fn).toHaveBeenCalledTimes(2);
    await r.unmount();
    await tick(); await tick();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('demo modunda hiç çağırmaz; hata olsa da sonraki turda dener', async () => {
    useMode.setState({ mode: 'demo' });
    const fn = jest.fn(async () => {});
    await render(<Probe fn={fn} />);
    await tick(); await tick();
    expect(fn).not.toHaveBeenCalled();

    useMode.setState({ mode: 'api' });
    const bad = jest.fn(async () => { throw new Error('ağ'); });
    await render(<Probe fn={bad} />);
    await tick(); await tick();
    expect(bad).toHaveBeenCalledTimes(2);
  });

  it('ekran arkada kalınca (odak yok) çağırmaz', async () => {
    useMode.setState({ mode: 'api' });
    const fn = jest.fn(async () => {});
    await render(<Probe fn={fn} on={false} />);
    await tick(); await tick();
    expect(fn).not.toHaveBeenCalled();
  });
});
