'use client';

import { useState, useEffect } from 'react';
import { getAuth } from 'firebase/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RichTextEditor } from '@/components/editor/rich-text-editor';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import Image from 'next/image';
import { Trash2, Edit2, Eye, EyeOff, Upload, Loader2, X } from 'lucide-react';
import { createBlogPost, getAllBlogPosts, updateBlogPost, deleteBlogPost } from '@/services/blogService';
import { uploadBlogImage, deleteBlogImage } from '@/services/storageService';
import { Translatable } from '@/components/translatable';
import { slugify, uniqueSlug } from '@/lib/slug';

interface BlogPost {
  id: string;
  slug?: string;
  title: string;
  caption: string;
  content: string;
  author: string;
  imageUrl: string;
  date?: { seconds: number };
  published: boolean;
}

interface FormData {
  title: string;
  caption: string;
  content: string;
  author: string;
  imageUrl: string;
  published: boolean;
}

const initialFormData: FormData = {
  title: '',
  caption: '',
  content: '',
  author: '',
  imageUrl: '',
  published: false,
};

export function AdminBlogManager() {
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchBlogPosts();
  }, []);

  const fetchBlogPosts = async () => {
    try {
      setIsFetching(true);
      const posts = await getAllBlogPosts();
      setBlogPosts(posts);
    } catch (error: any) {
      console.error('Error fetching blog posts:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch blog posts',
      });
    } finally {
      setIsFetching(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        variant: 'destructive',
        title: 'Invalid file',
        description: 'Please select an image file',
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: 'File too large',
        description: 'Image must be under 5MB',
      });
      return;
    }

    const auth = getAuth();
    if (!auth.currentUser) {
      toast({
        variant: 'destructive',
        title: 'Authentication required',
        description: 'You must be logged in as an admin to upload images',
      });
      return;
    }

    setUploadingImage(true);
    setUploadProgress(0);

    try {
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => (prev < 90 ? prev + 10 : prev));
      }, 100);

      const imageUrl = await uploadBlogImage(file);

      clearInterval(progressInterval);
      setUploadProgress(100);
      setFormData(prev => ({ ...prev, imageUrl }));

      toast({
        title: 'Success',
        description: 'Image uploaded successfully',
      });
    } catch (error: any) {
      console.error('Error uploading image:', error);
      toast({
        variant: 'destructive',
        title: 'Upload failed',
        description: error.message || 'Failed to upload image',
      });
    } finally {
      setUploadingImage(false);
      setUploadProgress(0);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title || !formData.caption || !formData.content || !formData.author || !formData.imageUrl) {
      toast({
        variant: 'destructive',
        title: 'Validation error',
        description: 'Please fill in all fields',
      });
      return;
    }

    const auth = getAuth();
    if (!auth.currentUser) {
      toast({
        variant: 'destructive',
        title: 'Authentication required',
        description: 'You must be logged in as an admin to manage blog posts',
      });
      return;
    }

    setIsLoading(true);

    // The slug is the post's public URL (/blog/[slug]). It is set once and never
    // regenerated on a title edit, so links already shared keep working.
    const buildSlug = (excludeId?: string) =>
      uniqueSlug(
        slugify(formData.title) || 'post',
        blogPosts.filter(post => post.id !== excludeId).map(post => post.slug || slugify(post.title))
      );

    try {
      if (editingPost) {
        await updateBlogPost(editingPost.id, {
          title: formData.title,
          caption: formData.caption,
          content: formData.content,
          author: formData.author,
          imageUrl: formData.imageUrl,
          published: formData.published,
          ...(editingPost.slug ? {} : { slug: buildSlug(editingPost.id) }),
        });
        toast({
          title: 'Success',
          description: 'Blog post updated successfully',
        });
        setEditingPost(null);
      } else {
        await createBlogPost({
          title: formData.title,
          caption: formData.caption,
          content: formData.content,
          author: formData.author,
          imageUrl: formData.imageUrl,
          published: formData.published,
          slug: buildSlug(),
        });
        toast({
          title: 'Success',
          description: 'Blog post created successfully',
        });
      }

      setFormData(initialFormData);
      setShowForm(false);
      await fetchBlogPosts();
    } catch (error: any) {
      console.error('Error saving blog post:', error);
      toast({
        variant: 'destructive',
        title: editingPost ? 'Failed to update post' : 'Failed to create post',
        description: error.message || 'An error occurred',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (post: BlogPost) => {
    setEditingPost(post);
    setFormData({
      title: post.title,
      caption: post.caption,
      content: post.content,
      author: post.author,
      imageUrl: post.imageUrl,
      published: post.published,
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePublishToggle = async (id: string, currentPublished: boolean) => {
    try {
      await updateBlogPost(id, { published: !currentPublished });
      toast({
        title: 'Success',
        description: `Post ${!currentPublished ? 'published' : 'unpublished'} successfully`,
      });
      await fetchBlogPosts();
    } catch (error: any) {
      console.error('Error updating post:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update post',
      });
    }
  };

  const handleDelete = async (post: BlogPost) => {
    if (!confirm(`Are you sure you want to delete "${post.title}"?`)) return;

    try {
      if (post.imageUrl) {
        await deleteBlogImage(post.imageUrl);
      }

      await deleteBlogPost(post.id);

      toast({
        title: 'Success',
        description: 'Blog post deleted successfully',
      });

      await fetchBlogPosts();
    } catch (error: any) {
      console.error('Error deleting post:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to delete post',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Add Post Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Blog Management</h2>
          <p className="text-muted-foreground mt-1">Create, edit, and manage blog posts</p>
        </div>
        <Button
          onClick={() => {
            if (showForm) {
              setShowForm(false);
              setEditingPost(null);
              setFormData(initialFormData);
            } else {
              setShowForm(true);
            }
          }}
          variant={showForm ? 'outline' : 'default'}
        >
          {showForm ? 'Cancel' : '+ New Post'}
        </Button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingPost ? 'Edit Blog Post' : 'Create New Blog Post'}</CardTitle>
            <CardDescription>
              {editingPost ? 'Update the fields below to edit this blog post' : 'Fill in all fields to create a new blog post'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  placeholder="Enter blog post title"
                  value={formData.title}
                  onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  required
                />
              </div>

              {/* Image Upload */}
              <div className="space-y-2">
                <Label>Featured Image *</Label>
                {formData.imageUrl ? (
                  <div className="relative w-full h-48 rounded-lg overflow-hidden border">
                    <Image
                      src={formData.imageUrl}
                      alt="Featured image"
                      fill
                      sizes="100vw"
                      className="object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, imageUrl: '' }))}
                      className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 transition"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-muted-foreground/30 rounded-lg cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      disabled={uploadingImage}
                      className="hidden"
                    />
                    {uploadingImage ? (
                      <div className="flex flex-col items-center gap-2 w-3/4">
                        <p className="text-sm text-muted-foreground">Uploading... {uploadProgress}%</p>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full transition-all duration-200"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Upload className="h-8 w-8" />
                        <p className="text-sm">Click to upload image</p>
                        <p className="text-xs">PNG, JPG, WEBP up to 5MB</p>
                      </div>
                    )}
                  </label>
                )}
              </div>

              {/* Caption */}
              <div className="space-y-2">
                <Label htmlFor="caption">Caption *</Label>
                <Input
                  id="caption"
                  placeholder="Short caption for the post"
                  value={formData.caption}
                  onChange={e => setFormData(prev => ({ ...prev, caption: e.target.value }))}
                  required
                />
              </div>

              {/* Author */}
              <div className="space-y-2">
                <Label htmlFor="author">Author *</Label>
                <Input
                  id="author"
                  placeholder="Author name"
                  value={formData.author}
                  onChange={e => setFormData(prev => ({ ...prev, author: e.target.value }))}
                  required
                />
              </div>

              {/* Content */}
              <div className="space-y-2">
                <Label htmlFor="content">Content *</Label>
                <RichTextEditor
                  value={formData.content}
                  onChange={html => setFormData(prev => ({ ...prev, content: html }))}
                  placeholder="Write your blog post..."
                />
                <p className="text-xs text-muted-foreground">
                  Use the toolbar to change font size, color, and add bold, italic or underlined text — just like Word.
                </p>
              </div>

              {/* Published Toggle */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="published"
                  checked={formData.published}
                  onCheckedChange={checked => setFormData(prev => ({ ...prev, published: checked as boolean }))}
                />
                <Label htmlFor="published" className="cursor-pointer">
                  {editingPost ? 'Published' : 'Publish immediately'}
                </Label>
              </div>

              {/* Submit Button */}
              <Button type="submit" disabled={isLoading || uploadingImage} className="w-full">
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {editingPost ? 'Saving changes...' : 'Creating post...'}
                  </>
                ) : (
                  editingPost ? 'Save Changes' : 'Create Post'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Blog Posts List */}
      <div className="space-y-4">
        <h3 className="text-xl font-semibold">All Blog Posts ({blogPosts.length})</h3>

        {isFetching ? (
          <Card>
            <CardContent className="py-8 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ) : blogPosts.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No blog posts yet. Create your first post!
            </CardContent>
          </Card>
        ) : (
          blogPosts.map(post => (
            <Card key={post.id} className="overflow-hidden hover:shadow-lg transition">
              <div className="flex flex-col md:flex-row">
                {/* Image */}
                <div className="w-full md:w-48 h-48 relative flex-shrink-0">
                  <Image
                    src={post.imageUrl}
                    alt={post.title}
                    fill
                    sizes="200px"
                    className="object-cover"
                  />
                </div>

                {/* Content */}
                <div className="flex-grow p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-grow">
                        <h3 className="text-lg font-semibold line-clamp-2">{post.title}</h3>
                        <p className="text-sm text-muted-foreground mt-1">{post.caption}</p>
                      </div>
                      <Badge variant={post.published ? 'default' : 'secondary'}>
                        {post.published ? 'Published' : 'Draft'}
                      </Badge>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      By {post.author} •{' '}
                      {post.date ? format(new Date(post.date.seconds * 1000), 'MMM d, yyyy') : 'Date unknown'}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-4 pt-4 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(post)}
                    >
                      <Edit2 className="h-4 w-4 mr-1" />
                      Edit
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePublishToggle(post.id, post.published)}
                    >
                      {post.published ? (
                        <>
                          <EyeOff className="h-4 w-4 mr-1" />
                          Unpublish
                        </>
                      ) : (
                        <>
                          <Eye className="h-4 w-4 mr-1" />
                          Publish
                        </>
                      )}
                    </Button>

                    <Button variant="destructive" size="sm" onClick={() => handleDelete(post)}>
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}