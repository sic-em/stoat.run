package edge

type Config struct {
	Port               int
	BaseDomain         string
	ControlPlaneURL    string
	ControlPlaneSecret string
	OverlayDir         string
	MaxBodySize        int64
	RateLimitRPS       float64
	LogLevel           string
}
