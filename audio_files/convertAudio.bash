for file in ./*; do
	ffmpeg -i "$file" -ac 2 -codec:a libmp3lame -b:a 48k -ar 16000 ./"${file%.*}".mp3
done
