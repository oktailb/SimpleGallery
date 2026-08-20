/**
 * SimpleGallery 2026 - Centralized Icon & Thumbnail Helper
 * Factorizes media categories, file extensions, and folder icon resolution across Explorer and Desktop.
 */
(function(window) {
  'use strict';

  const EXTENSION_ICONS = {
    // Images
    'jpg': '🖼️', 'jpeg': '🖼️', 'png': '🖼️', 'gif': '🖼️', 'webp': '🖼️', 'avif': '🖼️', 'svg': '🎨', 'bmp': '🖼️', 'ico': '🖼️', 'heic': '📷', 'heif': '📷',
    // Videos
    'mp4': '🎬', 'webm': '🎬', 'ogg': '🎬', 'mov': '🎥', 'm4v': '🎬', 'mkv': '🎬', 'avi': '🎬', 'wmv': '🎬',
    // Audio
    'mp3': '🎵', 'wav': '🎵', 'flac': '🎼', 'aac': '🎵', 'm4a': '🎵', 'wma': '🎵',
    // Documents
    'pdf': '📕', 'doc': '📄', 'docx': '📄', 'xls': '📊', 'xlsx': '📊', 'ppt': '📽️', 'pptx': '📽️', 'odt': '📄', 'ods': '📊', 'odp': '📽️',
    // Code & Text
    'txt': '📝', 'md': '📝', 'markdown': '📝', 'json': '📜', 'csv': '📊', 'xml': '📜', 'html': '🌐', 'css': '🎨', 'js': '⚡', 'php': '🐘', 'py': '🐍', 'sql': '🗄️', 'yaml': '⚙️', 'yml': '⚙️', 'log': '📋',
    // Archives
    'zip': '📦', 'tar': '📦', 'gz': '📦', 'tgz': '📦', 'bz2': '📦', '7z': '📦', 'rar': '📦'
  };

  const CATEGORY_ICONS = {
    'image': '🖼️',
    'video': '🎬',
    'audio': '🎵',
    'doc': '📄',
    'archive': '📦',
    'folder': '📁',
    'app': '🗔'
  };

  class IconHelperClass {
    getFileIcon(fileOrExt) {
      if (!fileOrExt) return '📄';
      const ext = typeof fileOrExt === 'string' 
        ? fileOrExt.toLowerCase().replace(/^\./, '') 
        : (fileOrExt.extension || (fileOrExt.name ? fileOrExt.name.split('.').pop() : '')).toLowerCase();
      
      if (EXTENSION_ICONS[ext]) return EXTENSION_ICONS[ext];

      if (typeof fileOrExt === 'object' && fileOrExt.category) {
        const cat = fileOrExt.category.toLowerCase();
        if (CATEGORY_ICONS[cat]) return CATEGORY_ICONS[cat];
      }

      return '📄';
    }

    getFolderIcon(folder) {
      if (!folder) return '📁';
      if (typeof folder === 'string') return '📁';
      return folder.icon || '📁';
    }

    getCategoryIcon(category) {
      if (!category) return '📁';
      return CATEGORY_ICONS[category.toLowerCase()] || '📁';
    }
  }

  window.IconHelper = new IconHelperClass();
  window.sys = window.sys || {};
  window.sys.icons = window.IconHelper;

})(window);
