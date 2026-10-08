import { initializeFirebase } from '@/firebase';
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';

const { firestore } = initializeFirebase();
const blogPostsCollection = collection(firestore, 'blogPosts');

/**
 * Creates a new blog post
 * @param {Object} postData - Blog post data
 * @param {string} postData.title - Post title
 * @param {string} postData.caption - Post caption
 * @param {string} postData.content - Post content
 * @param {string} postData.author - Post author
 * @param {string} postData.imageUrl - Post image URL
 * @param {boolean} postData.published - Published status
 * @param {string} [postData.slug] - URL slug for the post's public page
 * @returns {Promise<string>} - Document ID of the created post
 */
export async function createBlogPost(postData) {
  try {
    const docData = {
      ...postData,
      date: serverTimestamp(),
      published: postData.published || false,
    };
    const docRef = await addDoc(blogPostsCollection, docData);
    return docRef.id;
  } catch (error) {
    console.error('Error creating blog post:', error);
    throw error;
  }
}

/**
 * Fetches all blog posts ordered by date (descending)
 * @returns {Promise<Array>} - Array of all blog posts with their IDs
 */
export async function getAllBlogPosts() {
  try {
    const q = query(blogPostsCollection, orderBy('date', 'desc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error('Error fetching all blog posts:', error);
    throw error;
  }
}

/**
 * Fetches only published blog posts ordered by date (descending)
 * @returns {Promise<Array>} - Array of published blog posts with their IDs
 */
export async function getPublishedBlogPosts() {
  try {
    const q = query(
      blogPostsCollection,
      where('published', '==', true),
      orderBy('date', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error('Error fetching published blog posts:', error);
    throw error;
  }
}

/**
 * Updates a blog post by ID
 * @param {string} id - Document ID
 * @param {Object} updatedData - Data to update
 * @returns {Promise<void>}
 */
export async function updateBlogPost(id, updatedData) {
  try {
    const docRef = doc(firestore, 'blogPosts', id);
    await updateDoc(docRef, updatedData);
  } catch (error) {
    console.error('Error updating blog post:', error);
    throw error;
  }
}

/**
 * Deletes a blog post by ID
 * @param {string} id - Document ID
 * @returns {Promise<void>}
 */
export async function deleteBlogPost(id) {
  try {
    const docRef = doc(firestore, 'blogPosts', id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting blog post:', error);
    throw error;
  }
}
