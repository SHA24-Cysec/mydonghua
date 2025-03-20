---
date : '{{ .Date }}'
draft : false
title : 'Download Batch {{ replace .File.ContentBaseName "-" " " | title }} Subtitle Indonesia'
studio :
season : ''
genre :
type : 'Donghua'
status : 'Completed'
sub : 'Anichin'
durasi : ' Menit'
episode : ' Episode'
# Penulisan tanggal 'bulan tanggal, tahun'
release : ''
# Rating 1-10
rating : 

# Gunakan tag 'Belum tersedia jika layanan streaming belum ada'
# Layanan Streaming
Streaming : '{{ replace .File.ContentBaseName "-" " " | title }} Playlist [DailyMotion]'
LinkStreaming : ''

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

linkDownload360p : ''
buttonDownload360p : ''
ukuran360p : ''

linkDownload480p : ''
buttonDownload480p : ''
ukuran480p : ''

linkDownload720p : ''
buttonDownload720p : ''
ukuran720p : ''

linkDownload1080p : ''
buttonDownload1080p : ''
ukuran1080p : ''

linkDownload4K : ''
buttonDownload4K : ''
ukuran4K : ''
---