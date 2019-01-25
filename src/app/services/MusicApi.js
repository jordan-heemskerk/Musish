import axios from 'axios';
import Alert from 'react-s-alert';
import { API_URL } from '../utils/Utils';

export function getNextSongs(path) {
  return axios({
    method: 'get',
    url: `${API_URL}${path}`,
    headers: getHeaders(),
  });
}

export async function addSongsToPlaylist(playlistId, songs) {
  const payload = {
    data: songs.map(song => ({
      id: song.id,
      type: 'song',
    })),
  };

  try {
    await axios({
      method: 'post',
      url: `${API_URL}/v1/me/library/playlists/${playlistId}/tracks`,
      data: payload,
      headers: getHeaders(),
    });
    Alert.success("Added to your playlist, it'll show up in a few seconds. Hold tight!");
  } catch (error) {
    Alert.error("You're unable to add songs to this playlist.");
  }
}

export async function addAlbumToPlaylist(playlistId, albumId) {
  const music = MusicKit.getInstance();

  const album = await (isNaN(albumId)
    ? music.api.library.album(albumId)
    : music.api.album(albumId));

  const tracks = album.relationships.tracks.data.map(track => ({
    id: track.id,
    type: 'song',
  }));

  await addSongsToPlaylist(playlistId, tracks);
}

export async function addPlaylistToPlaylist(playlistId, sourcePlaylistId) {
  const music = MusicKit.getInstance();

  const playlist = await (sourcePlaylistId.startsWith('p.')
    ? music.api.library.playlist(sourcePlaylistId)
    : music.api.playlist(sourcePlaylistId));

  const tracks = playlist.relationships.tracks.data.map(track => ({
    id: track.id,
    type: 'song',
  }));

  await addSongsToPlaylist(playlistId, tracks);
}

export async function addToLibrary(mediaType, media) {
  try {
    await axios({
      method: 'post',
      url: `${API_URL}/v1/me/library?ids[${mediaType}]=${media.map(m => m).join(',')}`,
      headers: getHeaders(),
    });
    Alert.success("Added tracks to your library, they'll show up in a few seconds. Hold tight!");
  } catch (error) {
    Alert.error("We're unable to add these tracks to your library.");
  }
}

export function getHeaders() {
  const music = MusicKit.getInstance();

  return {
    Authorization: `Bearer ${music.developerToken}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'Music-User-Token': music.musicUserToken,
  };
}

export function infiniteLoadRelationships(
  id,
  functionGenerator,
  key,
  store,
  dataModifier = d => d
) {
  return async ({ offset }, { page }) => {
    if (page === 0) {
      const playlist = await functionGenerator(id, { offset });
      const data = playlist.relationships[key];

      // eslint-disable-next-line no-param-reassign
      store.nextUrl = data.next;

      return dataModifier(data.data);
    }

    if (!store.nextUrl) {
      return [];
    }

    const { data } = await getNextSongs(store.nextUrl);

    // eslint-disable-next-line no-param-reassign
    store.nextUrl = data.next;

    return dataModifier(data.data);
  };
}

// Okay, okay. This is horrible, I know. Am I a bad person for writing this? Maybe, but is whoever
// at Apple who designed the frameworks and APIs meaning we had to do this a bad person? Definitely.
// https://www.google.com/#q=Nearby+shops+selling+eye+wash
// https://www.google.com/images?q=cute+animals
export async function fetchFullCatalogAlbumFromLibraryAlbum(album) {
  const mk = MusicKit.getInstance();

  const firstSong = album.relationships.tracks.data.find(
    t => t.attributes && t.attributes.playParams && t.attributes.playParams.catalogId
  );

  if (!firstSong) {
    return null;
  }

  const firstSongId = firstSong.attributes.playParams.catalogId;
  const firstCatalogSong = await mk.api.song(firstSongId);

  for (const a of firstCatalogSong.relationships.albums.data) {
    // eslint-disable-next-line no-await-in-loop
    const catalogAlbum = await mk.api.album(a.id);
    if (
      catalogAlbum.attributes.artistName === album.attributes.artistName &&
      catalogAlbum.attributes.albumName === album.attributes.albumName
    ) {
      return catalogAlbum;
    }
  }
  return null;
}

function getRatingURL(type, id) {
  const BASE_URL = `${API_URL}/v1/me/ratings/`;
  const endpoints = {
    library: {
      song: 'library-songs',
      playlist: 'library-playlists',
      album: 'library-playlists',
    },
    catalog: {
      song: 'songs',
      playlist: 'playlists',
      album: 'albums',
    },
  };
  const choice = isNaN(id) ? endpoints.library : endpoints.catalog;
  if (!(type in choice)) {
    return false;
  }
  return `${BASE_URL}${choice[type]}/${id}`;
}

export function getRating(type, id) {
  const URL = getRatingURL(type, id);
  if (!URL) {
    return 0;
  }
  return axios({
    method: 'get',
    url: URL,
    headers: getHeaders(),
  })
    .then(response => response.data.data[0].attributes.value)
    .catch(error => 0);
}

export function setRating(type, id, rating) {
  const URL = getRatingURL(type, id);
  if (!URL) {
    return 0;
  }
  if (rating === 0) {
    return axios({
      method: 'delete',
      url: URL,
      headers: getHeaders(),
    })
      .then(response => response.data.data[0].attributes.value)
      .catch(error => 0);
  }
  return axios({
    method: 'put',
    url: URL,
    data: {
      type: 'rating',
      attributes: {
        value: rating,
      },
    },
    headers: getHeaders(),
  })
    .then(response => response.data.data[0].attributes.value)
    .catch(error => 0);
}
