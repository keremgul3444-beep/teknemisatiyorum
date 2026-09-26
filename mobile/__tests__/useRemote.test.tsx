import { Text } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import { useRemote } from '@/services/useRemote';
import { useMode } from '@/services/mode';

let reload: () => Promise<void> = async () => {};
function Probe({ load }: { load: () => Promise<number> }) {
  const r = useRemote(load);
  reload = r.reload;
  return <Text>{r.data === null ? 'boş' : String(r.data)}</Text>;
}

describe('useRemote', () => {
  afterEach(() => useMode.setState({ mode: 'demo' }));

  it('demo modunda sunucuya gitmez', async () => {
    useMode.setState({ mode: 'demo' });
    const load = jest.fn(async () => 1);
    await render(<Probe load={load} />);
    expect(load).not.toHaveBeenCalled();
    expect(screen.getByText('boş')).toBeTruthy();
  });

  it('api modunda yükler ve reload ile tazeler', async () => {
    useMode.setState({ mode: 'api' });
    let n = 0;
    const load = jest.fn(async () => ++n);
    await render(<Probe load={load} />);
    expect(await screen.findByText('1')).toBeTruthy();
    await act(() => reload());
    expect(screen.getByText('2')).toBeTruthy();
  });
});
