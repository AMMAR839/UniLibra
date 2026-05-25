package controllers

import (
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

var mapsCoordinatePatterns = []*regexp.Regexp{
	regexp.MustCompile(`@(-?\d+(?:\.\d+)?),\s*\+?(-?\d+(?:\.\d+)?)`),
	regexp.MustCompile(`!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)`),
	regexp.MustCompile(`(?:[?&](?:q|query|ll)=|/maps/search/)(-?\d+(?:\.\d+)?),\s*\+?(-?\d+(?:\.\d+)?)`),
}

func ResolveMapsLink(c *gin.Context) {
	rawLink := strings.TrimSpace(c.Query("url"))
	if rawLink == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Link Google Maps wajib diisi."})
		return
	}

	parsedURL, err := url.Parse(rawLink)
	if err != nil || parsedURL.Scheme == "" || parsedURL.Host == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Format link Google Maps tidak valid."})
		return
	}

	if !isAllowedMapsHost(parsedURL.Hostname()) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Link harus berasal dari Google Maps."})
		return
	}

	if latitude, longitude, ok := coordinatesFromText(rawLink); ok {
		c.JSON(http.StatusOK, gin.H{
			"latitude":  latitude,
			"longitude": longitude,
			"source":    "direct",
		})
		return
	}

	finalURL, body, err := fetchMapsRedirect(rawLink)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "Link Maps belum bisa dibuka dari backend."})
		return
	}
	if latitude, longitude, ok := coordinatesFromText(finalURL + " " + body); ok {
		c.JSON(http.StatusOK, gin.H{
			"latitude":  latitude,
			"longitude": longitude,
			"source":    "redirect",
		})
		return
	}

	c.JSON(http.StatusUnprocessableEntity, gin.H{"error": "Koordinat belum ditemukan pada link Maps."})
}

func fetchMapsRedirect(rawLink string) (string, string, error) {
	client := &http.Client{
		Timeout: 10 * time.Second,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 8 {
				return fmt.Errorf("terlalu banyak redirect")
			}
			return nil
		},
	}

	request, err := http.NewRequest(http.MethodGet, rawLink, nil)
	if err != nil {
		return "", "", err
	}
	request.Header.Set("User-Agent", "Mozilla/5.0 UniLibra/1.0")

	response, err := client.Do(request)
	if err != nil {
		return "", "", err
	}
	defer response.Body.Close()

	limitedBody, _ := io.ReadAll(io.LimitReader(response.Body, 512*1024))
	return response.Request.URL.String(), string(limitedBody), nil
}

func coordinatesFromText(value string) (float64, float64, bool) {
	decodedValue, err := url.QueryUnescape(value)
	if err != nil {
		decodedValue = value
	}
	decodedValue = strings.ReplaceAll(decodedValue, `\u0026`, "&")
	decodedValue = strings.ReplaceAll(decodedValue, "%2C", ",")
	decodedValue = strings.ReplaceAll(decodedValue, "%2c", ",")
	decodedValue = strings.ReplaceAll(decodedValue, "%2B", "+")
	decodedValue = strings.ReplaceAll(decodedValue, "%2b", "+")

	for _, pattern := range mapsCoordinatePatterns {
		match := pattern.FindStringSubmatch(decodedValue)
		if len(match) < 3 {
			continue
		}

		latitude, latErr := strconv.ParseFloat(match[1], 64)
		longitude, lonErr := strconv.ParseFloat(match[2], 64)
		if latErr == nil && lonErr == nil && validCoordinates(latitude, longitude) {
			return roundCoordinate(latitude), roundCoordinate(longitude), true
		}
	}

	return 0, 0, false
}

func validCoordinates(latitude float64, longitude float64) bool {
	return latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180
}

func roundCoordinate(value float64) float64 {
	rounded, _ := strconv.ParseFloat(fmt.Sprintf("%.6f", value), 64)
	return rounded
}

func isAllowedMapsHost(host string) bool {
	normalizedHost := strings.ToLower(strings.TrimSpace(host))
	return normalizedHost == "maps.app.goo.gl" ||
		normalizedHost == "goo.gl" ||
		normalizedHost == "maps.google.com" ||
		normalizedHost == "www.google.com" ||
		normalizedHost == "google.com"
}
