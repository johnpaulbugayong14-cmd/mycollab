import { addDoc, arrayUnion, collection, getDocs, getDoc, onSnapshot, serverTimestamp, updateDoc, doc, query, where, writeBatch } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db } from "./firebase.js";

const ACTIVE_ORGANIZATION_KEY = 'mycollab.active-organization-id';

function normalizeOrganizationEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function getActiveOrganizationId() {
  return localStorage.getItem(ACTIVE_ORGANIZATION_KEY) || '';
}

export function setActiveOrganizationId(organizationId) {
  if (organizationId) {
    localStorage.setItem(ACTIVE_ORGANIZATION_KEY, organizationId);
  } else {
    localStorage.removeItem(ACTIVE_ORGANIZATION_KEY);
  }
}

export function organizationIncludesEmail(organization, email) {
  const normalizedEmail = normalizeOrganizationEmail(email);
  const admins = Array.isArray(organization?.adminEmails) ? organization.adminEmails : [];
  const members = Array.isArray(organization?.memberEmails) ? organization.memberEmails : [];
  return [organization?.ownerEmail, ...admins, ...members]
    .some((candidate) => normalizeOrganizationEmail(candidate) === normalizedEmail);
}

export async function getOrganizationsForEmail(email) {
  const snapshot = await getDocs(collection(db, 'organizations'));
  return snapshot.docs
    .map((organizationDoc) => ({ id: organizationDoc.id, ...organizationDoc.data() }))
    .filter((organization) => organization.archived !== true && organizationIncludesEmail(organization, email));
}

export function subscribeToOrganizations(email, onChange, onError) {
  return onSnapshot(collection(db, 'organizations'), (snapshot) => {
    const organizations = snapshot.docs
      .map((organizationDoc) => ({ id: organizationDoc.id, ...organizationDoc.data() }))
      .filter((organization) => organization.archived !== true && organizationIncludesEmail(organization, email));
    onChange(organizations);
  }, onError);
}

export async function createOrganization({ name, description, ownerEmail }) {
  const normalizedOwnerEmail = normalizeOrganizationEmail(ownerEmail);
  if (!String(name || '').trim() || !normalizedOwnerEmail) {
    throw new Error('Organization name and owner are required.');
  }

  const organizationRef = await addDoc(collection(db, 'organizations'), {
    name: String(name).trim(),
    description: String(description || '').trim(),
    ownerEmail: normalizedOwnerEmail,
    adminEmails: [normalizedOwnerEmail],
    memberEmails: [normalizedOwnerEmail],
    archived: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  setActiveOrganizationId(organizationRef.id);
  return organizationRef.id;
}

export async function updateOrganization(organizationId, changes) {
  await updateDoc(doc(db, 'organizations', organizationId), {
    ...changes,
    updatedAt: serverTimestamp()
  });
}

export async function addOrganizationMember(organizationId, email) {
  const normalizedEmail = normalizeOrganizationEmail(email);
  if (!organizationId || !normalizedEmail) throw new Error('Organization and member email are required.');
  await updateDoc(doc(db, 'organizations', organizationId), {
    memberEmails: arrayUnion(normalizedEmail),
    updatedAt: serverTimestamp()
  });
}

export async function archiveOrganization(organizationId) {
  await updateOrganization(organizationId, { archived: true });
  if (getActiveOrganizationId() === organizationId) setActiveOrganizationId('');
}

export async function deleteOrganization(organizationId) {
  if (!organizationId) throw new Error('Organization is required.');

  const organizationSnapshot = await getDoc(doc(db, 'organizations', organizationId));
  if (!organizationSnapshot.exists()) throw new Error('Organization was not found.');

  const organization = organizationSnapshot.data() || {};
  const organizationEmails = new Set([
    organization.ownerEmail,
    ...(Array.isArray(organization.adminEmails) ? organization.adminEmails : []),
    ...(Array.isArray(organization.memberEmails) ? organization.memberEmails : [])
  ].map(normalizeOrganizationEmail).filter(Boolean));

  const otherOrganizationsSnapshot = await getDocs(collection(db, 'organizations'));
  const emailsInOtherOrganizations = new Set();
  otherOrganizationsSnapshot.docs
    .filter((organizationDoc) => organizationDoc.id !== organizationId)
    .forEach((organizationDoc) => {
      const otherOrganization = organizationDoc.data() || {};
      [
        otherOrganization.ownerEmail,
        ...(Array.isArray(otherOrganization.adminEmails) ? otherOrganization.adminEmails : []),
        ...(Array.isArray(otherOrganization.memberEmails) ? otherOrganization.memberEmails : [])
      ].map(normalizeOrganizationEmail).filter(Boolean).forEach((email) => emailsInOtherOrganizations.add(email));
    });

  const batch = writeBatch(db);
  
  // Collections that reference organizationId
  const collectionsToClean = [
    'tasks',
    'meetings',
    'surveys',
    'announcements',
    'inAppNotifications',
    'liveChats',
    'tickets',
    'resources',
    'polls'
  ];

  // Delete all documents in related collections with this organizationId
  for (const collectionName of collectionsToClean) {
    const q = query(collection(db, collectionName), where('organizationId', '==', organizationId));
    const snapshot = await getDocs(q);
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
  }

  // Remove credentials only for members exclusive to this organization.
  organizationEmails.forEach((email) => {
    if (!emailsInOtherOrganizations.has(email)) {
      batch.delete(doc(db, 'userCredentials', email));
      batch.delete(doc(db, 'userRoles', email));
    }
  });

  // Delete the organization document itself
  batch.delete(doc(db, 'organizations', organizationId));

  // Commit all deletions
  await batch.commit();

  // Clear active organization if it's the one being deleted
  if (getActiveOrganizationId() === organizationId) setActiveOrganizationId('');
}
