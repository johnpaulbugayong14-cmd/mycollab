import { addDoc, arrayUnion, collection, deleteDoc, getDocs, onSnapshot, serverTimestamp, updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
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
  await deleteDoc(doc(db, 'organizations', organizationId));
  if (getActiveOrganizationId() === organizationId) setActiveOrganizationId('');
}
