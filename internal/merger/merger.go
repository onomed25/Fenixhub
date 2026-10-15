package merger

import (
	"strings"
	"time"
)

func isPlaceholder(name string) bool {
	clean := strings.ToLower(strings.TrimSpace(name))
	switch clean {
	case "", "aleatorio", "aleatorlo", "aieatorio", "aieatorlo", "desconhecido", "null", "undefined", "anonymous", "anonimo":
		return true
	default:
		return false
	}
}

func getStreamKey(stream map[string]interface{}) string {
	name, _ := stream["name"].(string)
	url, _ := stream["url"].(string)
	return strings.TrimSpace(name) + "|" + strings.TrimSpace(url)
}

func InjectDateIntoStreams(conteudo map[string]interface{}) map[string]interface{} {
	if conteudo == nil {
		return nil
	}

	now := time.Now().UTC().Format(time.RFC3339)
	mediaType, _ := conteudo["type"].(string)

	if mediaType == "movie" {
		if rawStreams, ok := conteudo["streams"].([]interface{}); ok {
			for _, s := range rawStreams {
				if streamMap, ok := s.(map[string]interface{}); ok {
					if _, hasDate := streamMap["criado_em"]; !hasDate || streamMap["criado_em"] == nil || streamMap["criado_em"] == "" {
						streamMap["criado_em"] = now
					}
				}
			}
		}
	} else if mediaType == "series" {
		if seasonMap, ok := conteudo["streams"].(map[string]interface{}); ok {
			for _, epVal := range seasonMap {
				if epMap, ok := epVal.(map[string]interface{}); ok {
					for _, streamsVal := range epMap {
						if streamsList, ok := streamsVal.([]interface{}); ok {
							for _, s := range streamsList {
								if streamMap, ok := s.(map[string]interface{}); ok {
									if _, hasDate := streamMap["criado_em"]; !hasDate || streamMap["criado_em"] == nil || streamMap["criado_em"] == "" {
										streamMap["criado_em"] = now
									}
								}
							}
						}
					}
				}
			}
		}
	}

	return conteudo
}

func MergeStreamArrays(existingList, incomingList []interface{}) []interface{} {
	seenUrls := make(map[string]int)
	seenComposite := make(map[string]int)
	result := make([]interface{}, 0, len(existingList)+len(incomingList))

	for _, item := range existingList {
		stream, ok := item.(map[string]interface{})
		if !ok {
			continue
		}
		idx := len(result)
		result = append(result, stream)

		if url, ok := stream["url"].(string); ok && strings.TrimSpace(url) != "" {
			seenUrls[strings.TrimSpace(url)] = idx
		}
		compositeKey := getStreamKey(stream)
		if compositeKey != "|" {
			seenComposite[compositeKey] = idx
		}
	}

	for _, item := range incomingList {
		stream, ok := item.(map[string]interface{})
		if !ok {
			continue
		}

		rawUrl, _ := stream["url"].(string)
		cleanUrl := strings.TrimSpace(rawUrl)
		compositeKey := getStreamKey(stream)

		var matchIdx = -1
		if idx, exists := seenComposite[compositeKey]; exists && compositeKey != "|" {
			matchIdx = idx
		} else if idx, exists := seenUrls[cleanUrl]; exists && cleanUrl != "" {
			matchIdx = idx
		}

		if matchIdx >= 0 {
			// Update collaborator if existing had placeholder
			existingStream, ok := result[matchIdx].(map[string]interface{})
			if ok {
				existingColab, _ := existingStream["colaborador"].(string)
				incomingColab, _ := stream["colaborador"].(string)
				if isPlaceholder(existingColab) && !isPlaceholder(incomingColab) {
					existingStream["colaborador"] = incomingColab
					if id, ok := stream["colaborador_id"]; ok {
						existingStream["colaborador_id"] = id
					}
					if avatar, ok := stream["colaborador_avatar"]; ok {
						existingStream["colaborador_avatar"] = avatar
					}
					if role, ok := stream["colaborador_role"]; ok {
						existingStream["colaborador_role"] = role
					}
				}
			}
		} else {
			newIdx := len(result)
			result = append(result, stream)
			if cleanUrl != "" {
				seenUrls[cleanUrl] = newIdx
			}
			if compositeKey != "|" {
				seenComposite[compositeKey] = newIdx
			}
		}
	}

	return result
}

func MergeMediaContent(existing, incoming map[string]interface{}) map[string]interface{} {
	if existing == nil {
		return InjectDateIntoStreams(incoming)
	}
	if incoming == nil {
		return existing
	}

	incoming = InjectDateIntoStreams(incoming)
	mediaType, _ := existing["type"].(string)

	merged := make(map[string]interface{})
	for k, v := range existing {
		merged[k] = v
	}
	for k, v := range incoming {
		if k != "streams" {
			merged[k] = v
		}
	}

	if mediaType == "movie" {
		existingStreams, _ := existing["streams"].([]interface{})
		incomingStreams, _ := incoming["streams"].([]interface{})
		merged["streams"] = MergeStreamArrays(existingStreams, incomingStreams)
	} else if mediaType == "series" {
		existingSeasons, _ := existing["streams"].(map[string]interface{})
		incomingSeasons, _ := incoming["streams"].(map[string]interface{})

		if existingSeasons == nil {
			existingSeasons = make(map[string]interface{})
		}

		mergedSeasons := make(map[string]interface{})
		for sKey, sVal := range existingSeasons {
			mergedSeasons[sKey] = sVal
		}

		for seasonNum, incEpVal := range incomingSeasons {
			incEpMap, incIsMap := incEpVal.(map[string]interface{})
			if !incIsMap {
				continue
			}

			existEpMap, existIsMap := mergedSeasons[seasonNum].(map[string]interface{})
			if !existIsMap {
				mergedSeasons[seasonNum] = incEpMap
				continue
			}

			mergedEps := make(map[string]interface{})
			for eKey, eVal := range existEpMap {
				mergedEps[eKey] = eVal
			}

			for epNum, incStreamsVal := range incEpMap {
				incStreamsList, incStreamsOk := incStreamsVal.([]interface{})
				if !incStreamsOk {
					continue
				}

				existStreamsList, _ := mergedEps[epNum].([]interface{})
				mergedEps[epNum] = MergeStreamArrays(existStreamsList, incStreamsList)
			}
			mergedSeasons[seasonNum] = mergedEps
		}
		merged["streams"] = mergedSeasons
	}

	return merged
}
