---
date : '{{ .Date }}'
draft : false
title : '{{ replace .File.ContentBaseName "-" " " | title }}'
layout : halaman
url : '{{ .BaseFileName }}'
---