import * as ImagePicker from 'expo-image-picker';

import { supabase } from '@/services/supabase/client';

/**
 * Picks an image from the device library and uploads it to the
 * content-media bucket (supabase/migrations/20260829000007_storage_pipeline.sql),
 * then attaches its public URL to the given culture_items row via
 * admin_set_culture_item_image. fetch(asset.uri).arrayBuffer() (rather
 * than base64 + a decode dependency) works directly on both platforms'
 * local file URIs under Expo, so no extra package is needed just to get
 * the bytes.
 *
 * Returns null if the user cancels or denies the permission prompt -
 * both real, expected outcomes, not error conditions the caller needs to
 * handle specially.
 */
export async function pickAndUploadCultureItemImage(itemId: string): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
  const asset = result.canceled ? null : result.assets[0];
  if (!asset) return null;

  const ext = asset.uri.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `culture-items/${itemId}-${Date.now()}.${ext}`;

  const response = await fetch(asset.uri);
  const arrayBuffer = await response.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from('content-media')
    .upload(path, arrayBuffer, { contentType: asset.mimeType ?? 'image/jpeg', upsert: true });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('content-media').getPublicUrl(path);

  const { error: rpcError } = await supabase.rpc('admin_set_culture_item_image', {
    p_id: itemId,
    p_image_url: data.publicUrl,
  });
  if (rpcError) throw rpcError;

  return data.publicUrl;
}

/** Same flow as pickAndUploadCultureItemImage, for culture_materials rows
 * via admin_set_culture_material_image
 * (20260831000001_culture_materials_content.sql). */
export async function pickAndUploadCultureMaterialImage(materialId: string): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
  const asset = result.canceled ? null : result.assets[0];
  if (!asset) return null;

  const ext = asset.uri.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `culture-materials/${materialId}-${Date.now()}.${ext}`;

  const response = await fetch(asset.uri);
  const arrayBuffer = await response.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from('content-media')
    .upload(path, arrayBuffer, { contentType: asset.mimeType ?? 'image/jpeg', upsert: true });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('content-media').getPublicUrl(path);

  const { error: rpcError } = await supabase.rpc('admin_set_culture_material_image', {
    p_id: materialId,
    p_image_url: data.publicUrl,
  });
  if (rpcError) throw rpcError;

  return data.publicUrl;
}
