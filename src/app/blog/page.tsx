import { redirect } from 'next/navigation';

// The blog list lives on /instagram, which already opens on the "Our Blog" tab.
export default function BlogIndexPage() {
  redirect('/instagram');
}
