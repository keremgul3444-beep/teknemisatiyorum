import { parseVideoUrl } from '../src/video';

test('YouTube, Vimeo ve Instagram bağlantıları tek biçime; diğerleri reddedilir', () => {
  for (const u of ['https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10', 'https://youtu.be/dQw4w9WgXcQ', 'https://m.youtube.com/shorts/dQw4w9WgXcQ', 'https://youtube.com/embed/dQw4w9WgXcQ'])
    expect(parseVideoUrl(u)).toEqual({ provider: 'youtube', id: 'dQw4w9WgXcQ', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', embed: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ' });
  expect(parseVideoUrl('https://vimeo.com/76979871')).toMatchObject({ provider: 'vimeo', embed: 'https://player.vimeo.com/video/76979871?dnt=1' });
  expect(parseVideoUrl('https://www.instagram.com/reel/C1a2B3c4D5e/?igsh=x')).toMatchObject({ provider: 'instagram', url: 'https://www.instagram.com/reel/C1a2B3c4D5e/', embed: 'https://www.instagram.com/reel/C1a2B3c4D5e/embed' });
  for (const bad of ['', 'video', 'https://evil.com/watch?v=dQw4w9WgXcQ', 'javascript:alert(1)', 'https://youtube.com/watch?v=kisa', 'https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ'])
    expect(parseVideoUrl(bad)).toBeNull();
});
