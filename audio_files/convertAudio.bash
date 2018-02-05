for file in ./*; do
	ffmpeg -i "$file" -ac 2 -filter:a "volume=40dB" -b:a 48k -ar 16000 ./"${file%.*}".mp3
done
