---
date : '{{ .Date }}'
draft : false
title : 'Download Batch {{ replace .File.ContentBaseName "-" " " | title }} Subtitle Indonesia'
studio :
    - ''
season : ''
genre :
    - ''
type : 'Donghua'
status : 'Completed'
sub : 'Anichin'
durasi : ' Menit'

# Teks jumlah episode yang tampil untuk pengunjung.
episode : ' Episode'

# episodeCount bersifat opsional dan hanya dipakai untuk JSON-LD/SEO.
# - Jika `episode` hanya memiliki satu angka, field ini boleh tidak diisi.
#   Contoh: episode : '12 Episode' akan terbaca otomatis sebagai 12.
# - Jika `episode` memiliki lebih dari satu angka, isi jumlah totalnya.
#   Contoh: episode : '11 Episode + 4 Spesial' -> episodeCount : 15.
# - Jika jumlah episode belum diketahui, gunakan episode : 'Belum diketahui'
#   dan biarkan episodeCount tetap dikomentari.
# - Rentang batch seperti Episode 1-20 ditulis pada downloadGroups, bukan di sini.
# episodeCount : 15

# Penulisan tanggal 'bulan tanggal, tahun'
release : ''
# Rating 1-10
rating : 

# Jika ada Season selanjutnya, hilangkan komentar
# linkSeasonSelanjutnya : ''
# judulSeasonSelanjutnya : ''

# Jika ada Season sebelumnya, hilangkan komentar
# linkSeasonSebelumnya : ''
# judulSeasonSebelumnya : ''

# Gambar width: 200, height : 300
thumbnail : /img/post/
image : /img/post/

alt : '{{ replace .File.ContentBaseName "-" " " | title }}'
url: '{{ .BaseFileName }}'
layout : postingan-donghua
sinopsis : ''
deskripsi : 'Download Batch {{ replace .File.ContentBaseName "-" " " | title }} Subtitle Indonesia'
keywords : 'Download Batch {{ replace .File.ContentBaseName "-" " " | title }} Subtitle Indonesia'

# Jika Link Download Belum Ada, Gunakan Tag "Belum Tersedia", Jika Ada Gunakan Tag "Download"

downloadGroups:
  
  # Batch 1
  - title: '{{ replace .File.ContentBaseName "-" " " | title }} Batch Subtitle Indonesia'
    
    downloads:
    
    - quality: '360p'
      link: ''
      button: ''
      size: ''
    
    - quality: '480p'
      link: ''
      button: ''
      size: ''
    
    - quality: '720p'
      link: ''
      button: ''
      size: ''
    
    - quality: '1080p'
      link: ''
      button: ''
      size: ''
    
    - quality: '4K'
      link: ''
      button: ''
      size: ''
---