for file in ./*; do
	ffmpeg -i "$file" -ac 2 -b:a 48k -ar 16000 ./mp3s/"${file%.*}".mp3
done
